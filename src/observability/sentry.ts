/**
 * 管理台的 Sentry 接入。
 *
 * 与移动端 observability/sentry.ts 同一套原则：
 * - 没配 `VITE_SENTRY_DSN` 就完全是 no-op（不 init、不发一个字节）；
 * - 发出去的事件按白名单重建：堆栈帧位置、错误类名、归一化后的路径、少量固定 tag；
 *   异常 message / 面包屑文本 / 请求 query / 账号标识一律不带；
 * - 业务代码只能走 reportError / reportApiFailure，两者在未初始化时静默。
 */
import * as Sentry from "@sentry/react";

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
const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_WITH_QUERY_PATTERN = /https?:\/\/[^\s"'<>)]*\?[^\s"'<>)]*/gi;

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

/** `/users/<uuid>/notes/123?x=1` → `/users/:id/notes/:id`。 */
export function normalizePath(value: string): string {
  const withoutQuery = value.split("?")[0].split("#")[0];
  return withoutQuery
    .split("/")
    .map((segment) => {
      if (segment === "") return segment;
      if (/^\d+$/.test(segment) || UUID_SEGMENT.test(segment)) return ":id";
      if (segment.length >= 16 && /\d/.test(segment)) return ":id";
      return segment;
    })
    .join("/");
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
      beforeSend: sanitizeEvent,
      beforeBreadcrumb: (crumb: Record<string, unknown>) =>
        sanitizeBreadcrumb(crumb),
    });
    sentryInitialized = true;
    return true;
  } catch {
    sentryInitialized = false;
    return false;
  }
}

/** 测试隔离用。 */
export function resetSentryForTests(): void {
  sentryInitialized = false;
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
