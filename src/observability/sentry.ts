/**
 * 管理台的 Sentry 接入。
 *
 * 与移动端 observability/sentry.ts 同一套原则：
 * - 没配 `VITE_SENTRY_DSN` 就完全是 no-op（不 init、不发一个字节）；
 * - 发出去的事件按白名单重建：堆栈帧位置、错误类名、归一化后的路径、少量固定 tag；
 *   异常 message / 面包屑文本 / 请求 query / 账号标识一律不带；
 * - 业务代码只能走 reportError / reportApiFailure，两者在未初始化时静默；
 * - 脱敏器自身抛错时事件直接丢弃（fail closed），绝不让 SDK 的内部兜底事件绕过脱敏；
 * - 同一指纹在一次页面生命周期内最多上报 MAX_REPORTS_PER_FINGERPRINT 次。
 */
import * as Sentry from "@sentry/react";
import { STATIC_ROUTE_SEGMENTS } from "./route-segments";

export type SentryClientLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (
    error: unknown,
    context?: { tags?: Record<string, string>; fingerprint?: string[] },
  ) => unknown;
};

export interface ReportContext {
  operation: string;
  kind: string;
  method?: string;
  status?: number;
  path?: string;
}

const STABLE_TAG = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
/** `https://host` / `//host` 前缀：fetch 面包屑里的 url 是绝对地址。 */
const ABSOLUTE_URL_PREFIX = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*/i;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_WITH_QUERY_PATTERN = /https?:\/\/[^\s"'<>)]*\?[^\s"'<>)]*/gi;

/**
 * 众所周知的浏览器噪音：不是我们的 bug，也没有可操作性。ResizeObserver 两条是
 * Chrome / Firefox 对布局抖动的告警；chunk 加载失败是部署切换后旧页面拿不到旧资源，
 * 刷新即好。Sentry 对字符串条目做子串匹配。
 */
const IGNORED_BROWSER_NOISE: (string | RegExp)[] = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk .* failed/,
];

/**
 * 同一指纹（operation + kind + status + method + 归一化路径）在一次页面生命周期内
 * 最多上报的次数。持续故障（后端整体 5xx、断网）会让每次轮询都失败，没有上限时
 * 一个标签页几分钟就能吃掉配额、把真正的新问题淹没在重复里。
 * 按进程生命周期而不是滑动窗口计数：不需要计时器，语义可预测（刷新即重置）；
 * 「还在发生吗」由 Sentry 服务端的 issue 聚合回答。key 里的路径已归一化，
 * 所以 `/admin/users/1` 与 `/admin/users/2` 的同类失败共用一份配额。
 */
const MAX_REPORTS_PER_FINGERPRINT = 3;
const reportCounts = new Map<string, number>();

let sentryInitialized = false;
const defaultClient = Sentry as unknown as SentryClientLike;

function readTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function resolveSentryDsn(
  env: Record<string, unknown> = import.meta.env,
): string | undefined {
  return readTrimmed(env.VITE_SENTRY_DSN);
}

/**
 * 把路径收敛成「路由形状」：`/admin/users/42/status?x=1` → `/admin/users/:id/status`。
 *
 * 判定是**白名单**而不是「看起来像不像标识符」（与移动端 sanitizeTransactionName /
 * route-segments.ts 同一决定）：后端 id 是不透明的，community.ts 会请求
 * `/admin/community/circles/${id}/${action}`，一个纯字母的 circle id（privatecircle）
 * 用任何字符类规则都无法与真正的静态段区分开 —— 靠猜就一定漏。所以只有出现在
 * 路由表 / API 字面路径里的段（STATIC_ROUTE_SEGMENTS）才保留，其余一律 `:id`。
 * 带 scheme 的绝对 URL（fetch 面包屑）只取 path：host 对分组没有价值，而第三方
 * 直传地址（预签名上传）本来就不该出现在上报里。
 */
export function normalizePath(value: string): string {
  const path = value
    .trim()
    .replace(ABSOLUTE_URL_PREFIX, "")
    .split("?")[0]
    .split("#")[0];
  const normalized = path
    .split("/")
    .map((segment) => {
      if (segment === "") return segment;
      return STATIC_ROUTE_SEGMENTS.has(segment) ? segment : ":id";
    })
    .join("/");
  // 白名单之后理论上只剩静态词、`:id` 与斜杠；再过一遍 sanitizeString 是纵深防御。
  return sanitizeString(normalized);
}

export function sanitizeString(value: string): string {
  return value
    .replace(URL_WITH_QUERY_PATTERN, "[REDACTED_URL]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_TOKEN]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

function stableTag(value: unknown, fallback: string): string {
  return typeof value === "string" && STABLE_TAG.test(value) ? value : fallback;
}

function sanitizeFrames(stacktrace: unknown): unknown {
  if (!stacktrace || typeof stacktrace !== "object") return undefined;
  const frames = (stacktrace as { frames?: unknown }).frames;
  if (!Array.isArray(frames)) return undefined;
  return {
    frames: frames.map((frame) => {
      if (!frame || typeof frame !== "object") return {};
      const source = frame as Record<string, unknown>;
      const safe: Record<string, unknown> = {};
      for (const key of ["filename", "function", "lineno", "colno", "in_app"]) {
        const child = source[key];
        if (typeof child === "string") safe[key] = sanitizeString(child);
        else if (typeof child === "number" || typeof child === "boolean") {
          safe[key] = child;
        }
      }
      return safe;
    }),
  };
}

/**
 * mechanism 说明这条异常是怎么被捕获的（onerror / onunhandledrejection /
 * error_boundary …、handled 与否），是 Sentry 区分「崩溃」与「已处理」的依据。
 * 只放行有界的 type 与两个布尔位；`data`（函数名、handler 等）丢弃。
 */
function sanitizeMechanism(mechanism: unknown): Record<string, unknown> | undefined {
  if (!mechanism || typeof mechanism !== "object") return undefined;
  const source = mechanism as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  if (typeof source.type === "string" && STABLE_TAG.test(source.type)) {
    safe.type = source.type;
  }
  if (typeof source.handled === "boolean") safe.handled = source.handled;
  if (typeof source.synthetic === "boolean") safe.synthetic = source.synthetic;
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function sanitizeException(exception: unknown): unknown {
  if (!exception || typeof exception !== "object") return undefined;
  const values = (exception as { values?: unknown }).values;
  if (!Array.isArray(values)) return undefined;
  return {
    values: values.map((entry) => {
      const source = (entry ?? {}) as Record<string, unknown>;
      const safe: Record<string, unknown> = {
        type: stableTag(source.type, "Error"),
        value: "[REDACTED_EXCEPTION]",
      };
      const stacktrace = sanitizeFrames(source.stacktrace);
      if (stacktrace) safe.stacktrace = stacktrace;
      const mechanism = sanitizeMechanism(source.mechanism);
      if (mechanism) safe.mechanism = mechanism;
      return safe;
    }),
  };
}

const SAFE_TAG_KEYS = ["operation", "kind", "method", "status", "path"];

function sanitizeTags(tags: unknown): Record<string, string> | undefined {
  if (!tags || typeof tags !== "object") return undefined;
  const safe: Record<string, string> = {};
  for (const key of SAFE_TAG_KEYS) {
    const value = (tags as Record<string, unknown>)[key];
    if (typeof value === "string" || typeof value === "number") {
      safe[key] = sanitizeString(String(value));
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function sanitizeBreadcrumb(
  breadcrumb: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of ["type", "category", "level", "timestamp"]) {
    if (key in breadcrumb) safe[key] = breadcrumb[key];
  }
  // fetch/xhr 面包屑的 url 保留路径形状(定位是哪个接口),丢掉 query 与标识符;
  // 自由文本 message 一律不要。
  const data = breadcrumb.data;
  if (data && typeof data === "object") {
    const source = data as Record<string, unknown>;
    const safeData: Record<string, unknown> = {};
    if (typeof source.url === "string") safeData.url = normalizePath(source.url);
    if (typeof source.method === "string") safeData.method = source.method;
    if (typeof source.status_code === "number") {
      safeData.status_code = source.status_code;
    }
    if (Object.keys(safeData).length > 0) safe.data = safeData;
  }
  return safe;
}

/** `beforeSend`：整个事件按白名单重建，未列出的字段(request、user、extra…)一律丢弃。 */
export function sanitizeEvent<T extends Record<string, unknown>>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const safe: Record<string, unknown> = {};
  for (const key of [
    "event_id",
    "timestamp",
    "platform",
    "level",
    "release",
    "environment",
    "sdk",
  ]) {
    if (key in event) safe[key] = event[key];
  }
  if (typeof event.transaction === "string") {
    safe.transaction = normalizePath(event.transaction);
  }
  const exception = sanitizeException(event.exception);
  if (exception) safe.exception = exception;
  const tags = sanitizeTags(event.tags);
  if (tags) safe.tags = tags;
  if (Array.isArray(event.fingerprint)) {
    safe.fingerprint = event.fingerprint.map((part) =>
      sanitizeString(String(part)),
    );
  }
  if (Array.isArray(event.breadcrumbs)) {
    safe.breadcrumbs = event.breadcrumbs
      .filter((crumb) => crumb && typeof crumb === "object")
      .map((crumb) => sanitizeBreadcrumb(crumb as Record<string, unknown>));
  }
  return safe as T;
}

export interface InitSentryOptions {
  client?: SentryClientLike;
  env?: Record<string, unknown>;
}

type Sanitizer = (input: Record<string, unknown>) => Record<string, unknown>;

/**
 * 脱敏器抛错 → 返回 null 丢弃这条。@sentry/core 会把 beforeSend 抛出的异常当作
 * SDK 内部错误重新 captureException（hint.data.__sentry__ = true），而带该标记的
 * 替代事件**不再经过 beforeSend** —— scope 上的面包屑、tags、请求 URL 会原样发出。
 * 所以异常绝不能逃出这里：宁可少一条事件，不能多一条未脱敏的。
 */
function failClosed(
  sanitize: Sanitizer,
): (input: Record<string, unknown>) => Record<string, unknown> | null {
  return (input) => {
    try {
      return sanitize(input);
    } catch {
      return null;
    }
  };
}

/** 只有配置了 DSN 才 init；未配置返回 false，之后所有上报都是 no-op。 */
export function initSentry(options: InitSentryOptions = {}): boolean {
  const client = options.client ?? defaultClient;
  const env = options.env ?? (import.meta.env as Record<string, unknown>);
  const dsn = resolveSentryDsn(env);
  if (!dsn) return false;
  try {
    client.init({
      dsn,
      environment: readTrimmed(env.VITE_APP_ENV) ?? "production",
      ...(readTrimmed(env.VITE_APP_RELEASE)
        ? { release: readTrimmed(env.VITE_APP_RELEASE) }
        : {}),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      ignoreErrors: IGNORED_BROWSER_NOISE,
      beforeSend: failClosed(sanitizeEvent),
      beforeBreadcrumb: failClosed(sanitizeBreadcrumb),
    });
    sentryInitialized = true;
    return true;
  } catch {
    sentryInitialized = false;
    return false;
  }
}

/** 测试隔离用：清掉初始化标记与按指纹的上报计数。 */
export function resetSentryForTests(): void {
  sentryInitialized = false;
  reportCounts.clear();
}

/** 给这次上报计数；该指纹已达 MAX_REPORTS_PER_FINGERPRINT 时返回 false。 */
function underReportCap(key: string): boolean {
  const count = reportCounts.get(key) ?? 0;
  if (count >= MAX_REPORTS_PER_FINGERPRINT) return false;
  reportCounts.set(key, count + 1);
  return true;
}

function toSafeError(error: unknown, message: string): Error {
  const safe = new Error(message);
  if (error && typeof error === "object") {
    const source = error as { name?: unknown; stack?: unknown };
    safe.name = stableTag(source.name, "Error");
    if (typeof source.stack === "string") {
      const [, ...rest] = sanitizeString(source.stack).split("\n");
      safe.stack = [`${safe.name}: ${message}`, ...rest].join("\n");
    }
  }
  return safe;
}

/**
 * 已处理失败 → Sentry。未初始化时（没有 DSN）静默；`client` 可注入供测试。
 * fingerprint 由 operation + kind (+ status) 决定，避免按被脱敏的 message 分组。
 * 同一指纹 + method + 归一化路径在一次页面生命周期内最多发 MAX_REPORTS_PER_FINGERPRINT 条。
 */
export function reportError(
  error: unknown,
  context: ReportContext,
  client: SentryClientLike | null = null,
): void {
  const target = client ?? (sentryInitialized ? defaultClient : null);
  if (!target) return;
  try {
    const operation = stableTag(context.operation, "unknownOperation");
    const kind = stableTag(context.kind, "unknownKind");
    const tags: Record<string, string> = { operation, kind };
    if (context.method) tags.method = stableTag(context.method, "UNKNOWN");
    if (typeof context.status === "number") tags.status = String(context.status);
    if (context.path) tags.path = normalizePath(context.path);
    const capKey = [
      operation,
      kind,
      tags.status ?? "no-status",
      tags.method ?? "-",
      tags.path ?? "-",
    ].join("|");
    if (!underReportCap(capKey)) return;
    target.captureException(toSafeError(error, `${operation} ${kind} failure`), {
      tags,
      fingerprint: [operation, kind, tags.status ?? "no-status"],
    });
  } catch {
    // 可观测性绝不能改变业务行为。
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * API 失败的上报规则（与移动端 api/client 同一条线）：网络不可达与 5xx 报；
 * 预期内的 4xx（登录失效、校验失败、404）不报；调用方主动取消不报。
 */
export function reportApiFailure(
  error: unknown,
  context: { path: string; method?: string },
  client: SentryClientLike | null = null,
): void {
  if (isAbortError(error)) return;
  const status =
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ApiError"
      ? (error as { status?: unknown }).status
      : undefined;
  if (typeof status === "number") {
    if (status < 500) return;
    reportError(
      error,
      {
        operation: "api",
        kind: "server",
        method: context.method ?? "GET",
        status,
        path: context.path,
      },
      client,
    );
    return;
  }
  reportError(
    error,
    {
      operation: "api",
      kind: "network",
      method: context.method ?? "GET",
      path: context.path,
    },
    client,
  );
}

/** React 渲染错误边界：未 init 时 captureException 是 SDK 内的 no-op。 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
