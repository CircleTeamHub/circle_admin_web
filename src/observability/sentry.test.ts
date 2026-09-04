import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initSentry,
  normalizePath,
  reportApiFailure,
  reportError,
  resetSentryForTests,
  resolveSentryDsn,
  sanitizeEvent,
  type SentryClientLike,
} from "./sentry";

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  ErrorBoundary: ({ children }: { children: unknown }) => children,
}));

function fakeClient() {
  const captured: { error: Error; context: unknown }[] = [];
  const client: SentryClientLike & { inits: Record<string, unknown>[] } = {
    inits: [],
    init(options) {
      client.inits.push(options);
    },
    captureException(error, context) {
      captured.push({ error: error as Error, context });
      return "event-id";
    },
  };
  return { client, captured };
}

describe("resolveSentryDsn", () => {
  it("returns undefined when the variable is missing or blank", () => {
    expect(resolveSentryDsn({})).toBeUndefined();
    expect(resolveSentryDsn({ VITE_SENTRY_DSN: "   " })).toBeUndefined();
    expect(resolveSentryDsn({ VITE_SENTRY_DSN: " https://a@o/1 " })).toBe(
      "https://a@o/1",
    );
  });
});

describe("initSentry", () => {
  beforeEach(() => resetSentryForTests());

  it("stays dormant without a DSN", () => {
    const { client } = fakeClient();
    expect(initSentry({ client, env: {} })).toBe(false);
    expect(client.inits).toEqual([]);
  });

  it("initializes without PII and with a sanitizing beforeSend", () => {
    const { client } = fakeClient();
    expect(
      initSentry({
        client,
        env: { VITE_SENTRY_DSN: "https://a@o/1", VITE_APP_ENV: "staging" },
      }),
    ).toBe(true);
    expect(client.inits[0]).toEqual(
      expect.objectContaining({
        dsn: "https://a@o/1",
        environment: "staging",
        sendDefaultPii: false,
        tracesSampleRate: 0,
      }),
    );
    expect(typeof client.inits[0].beforeSend).toBe("function");
  });

  it("tells the SDK to ignore well-known benign browser noise", () => {
    const { client } = fakeClient();
    initSentry({ client, env: { VITE_SENTRY_DSN: "https://a@o/1" } });
    expect(client.inits[0].ignoreErrors).toEqual([
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk .* failed/,
    ]);
  });

  it("drops the event when the sanitizer throws instead of letting the SDK self-capture", () => {
    const { client } = fakeClient();
    initSentry({ client, env: { VITE_SENTRY_DSN: "https://a@o/1" } });
    const beforeSend = client.inits[0].beforeSend as (
      event: Record<string, unknown>,
    ) => unknown;
    const beforeBreadcrumb = client.inits[0].beforeBreadcrumb as (
      crumb: Record<string, unknown>,
    ) => unknown;

    // 正常事件照常脱敏。
    expect(beforeSend({ event_id: "e1", transaction: "/users/42" })).toEqual({
      event_id: "e1",
      transaction: "/users/:id",
    });

    // getter 抛错：@sentry/core 会把这种异常自我捕获成一条绕过 beforeSend 的替代事件，
    // 所以这里必须吞掉并返回 null。
    const poisoned: Record<string, unknown> = { event_id: "e2" };
    Object.defineProperty(poisoned, "transaction", {
      enumerable: true,
      get() {
        throw new Error("poisoned getter");
      },
    });
    expect(beforeSend(poisoned)).toBeNull();

    // fingerprint 里塞了无法转成字符串的值（String() 抛 TypeError）。
    expect(beforeSend({ event_id: "e3", fingerprint: [Object.create(null)] })).toBeNull();

    const poisonedCrumb: Record<string, unknown> = { type: "http" };
    Object.defineProperty(poisonedCrumb, "data", {
      enumerable: true,
      get() {
        throw new Error("poisoned getter");
      },
    });
    expect(beforeBreadcrumb(poisonedCrumb)).toBeNull();
  });
});

describe("sanitizeEvent", () => {
  it("rebuilds the event from an allowlist and strips identifiers", () => {
    const sanitized = sanitizeEvent({
      event_id: "e1",
      platform: "javascript",
      transaction: "/users/0f8fad5b-d9cb-469f-a165-70867728950e?tab=notes",
      request: { url: "https://admin/x?token=abc", headers: { cookie: "a=b" } },
      user: { id: "admin-1", email: "admin@example.com" },
      extra: { body: { password: "secret" } },
      exception: {
        values: [
          {
            type: "TypeError",
            value: "Cannot read admin@example.com Bearer abc.def.ghi",
            stacktrace: {
              frames: [
                { filename: "app.js", function: "load", lineno: 4, colno: 2, vars: { token: "x" } },
              ],
            },
          },
        ],
      },
      tags: { operation: "api", kind: "server", status: 503, userId: "u-1" },
      breadcrumbs: [
        {
          type: "http",
          category: "fetch",
          data: { url: "/api/v1/users/42?email=admin@example.com", method: "GET", status_code: 503 },
          message: "GET /api/v1/users/42",
        },
      ],
    });

    expect(sanitized.transaction).toBe("/users/:id");
    expect(sanitized.tags).toEqual({ operation: "api", kind: "server", status: "503" });
    expect((sanitized.exception as any).values[0]).toEqual({
      type: "TypeError",
      value: "[REDACTED_EXCEPTION]",
      stacktrace: { frames: [{ filename: "app.js", function: "load", lineno: 4, colno: 2 }] },
    });
    expect(sanitized.breadcrumbs).toEqual([
      {
        type: "http",
        category: "fetch",
        data: { url: "/api/v1/users/:id", method: "GET", status_code: 503 },
      },
    ]);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toMatch(/admin@example\.com|token=abc|secret|admin-1|cookie|Bearer/);
  });

  it("keeps the exception mechanism's type/handled/synthetic and nothing else", () => {
    const sanitized = sanitizeEvent({
      exception: {
        values: [
          {
            type: "TypeError",
            value: "boom",
            mechanism: {
              type: "onunhandledrejection",
              handled: false,
              synthetic: true,
              data: { function: "secretHandler" },
            },
          },
          {
            type: "Error",
            value: "x",
            mechanism: { type: "<script>alert(1)</script>", handled: "yes" },
          },
          { type: "Error", value: "y" },
        ],
      },
    });

    const values = (sanitized.exception as any).values;
    expect(values[0].mechanism).toEqual({
      type: "onunhandledrejection",
      handled: false,
      synthetic: true,
    });
    expect(values[1]).not.toHaveProperty("mechanism");
    expect(values[2]).not.toHaveProperty("mechanism");
    expect(JSON.stringify(sanitized)).not.toMatch(/secretHandler|alert/);
  });
});

describe("normalizePath", () => {
  it("keeps whitelisted static segments and drops the query string and fragment", () => {
    expect(normalizePath("/api/v1/admin/users/42/audit-logs?limit=20#top")).toBe(
      "/api/v1/admin/users/:id/audit-logs",
    );
    expect(normalizePath("/admin/dashboard?range=7d")).toBe("/admin/dashboard");
    expect(normalizePath("/system")).toBe("/system");
    expect(normalizePath("/admin/support/recharge/orders")).toBe("/admin/support/recharge/orders");
    expect(normalizePath("/api/v1/auth/me")).toBe("/api/v1/auth/me");
  });

  it("collapses every non-whitelisted segment, including opaque and email-like ids", () => {
    // 后端 id 不透明：纯字母的 circle id 用任何字符类规则都无法与静态段区分。
    expect(normalizePath("/admin/community/circles/privatecircle/disable")).toBe(
      "/admin/community/circles/:id/disable",
    );
    expect(normalizePath("/admin/users/admin@example.com/status")).toBe(
      "/admin/users/:id/status",
    );
    expect(normalizePath("/admin/users/0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(
      "/admin/users/:id",
    );
    expect(normalizePath("/admin/users/42")).toBe("/admin/users/:id");
    // 路由模板里的参数名也不该原样出现。
    expect(normalizePath("users/:userId")).toBe("users/:id");
    // 不在路由表里的词一律按标识符处理，哪怕它长得像静态段。
    expect(normalizePath("/admin/users/42/notes")).toBe("/admin/users/:id/:id");
  });

  it("reduces absolute URLs to their route shape", () => {
    expect(normalizePath("https://admin.example.com/api/v1/admin/dashboard?range=7d")).toBe(
      "/api/v1/admin/dashboard",
    );
    // 预签名直传地址：host、对象 key、签名一个都不留。
    expect(
      normalizePath(
        "https://bucket.r2.example.com/chat/support-recharge-abc.jpg?X-Amz-Signature=deadbeef",
      ),
    ).toBe("/:id/:id");
    expect(normalizePath("//cdn.example.com/users/42")).toBe("/users/:id");
  });
});

describe("reportError / reportApiFailure", () => {
  beforeEach(() => resetSentryForTests());

  it("is a no-op when Sentry was never initialized", () => {
    expect(() => reportError(new Error("x"), { operation: "a", kind: "b" })).not.toThrow();
  });

  it("captures a sanitized error with stable tags and fingerprint", () => {
    const { client, captured } = fakeClient();
    const error = new Error("secret admin@example.com");
    error.name = "SyncError";

    reportError(error, { operation: "users", kind: "load", path: "/users/42" }, client);

    expect(captured).toHaveLength(1);
    expect(captured[0].error.name).toBe("SyncError");
    expect(captured[0].error.message).toBe("users load failure");
    expect(captured[0].context).toEqual({
      tags: { operation: "users", kind: "load", path: "/users/:id" },
      fingerprint: ["users", "load", "no-status"],
    });
  });

  it("reports network failures and 5xx but never expected 4xx or aborts", () => {
    const { client, captured } = fakeClient();
    const notFound = Object.assign(new Error("nope"), { name: "ApiError", status: 404 });
    const unauthorized = Object.assign(new Error("expired"), { name: "ApiError", status: 401 });
    const outage = Object.assign(new Error("bad gateway"), { name: "ApiError", status: 502 });
    const network = new TypeError("Failed to fetch");
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });

    for (const error of [notFound, unauthorized, aborted]) {
      reportApiFailure(error, { path: "/users/42", method: "GET" }, client);
    }
    expect(captured).toHaveLength(0);

    reportApiFailure(outage, { path: "/users/42", method: "PATCH" }, client);
    reportApiFailure(network, { path: "/reports?x=1" }, client);

    expect(captured.map((c) => c.context)).toEqual([
      {
        tags: { operation: "api", kind: "server", method: "PATCH", status: "502", path: "/users/:id" },
        fingerprint: ["api", "server", "502"],
      },
      {
        tags: { operation: "api", kind: "network", method: "GET", path: "/reports" },
        fingerprint: ["api", "network", "no-status"],
      },
    ]);
  });

  it("caps identical failures at three per fingerprint per page lifetime", () => {
    const { client, captured } = fakeClient();
    const outage = Object.assign(new Error("bad gateway"), { name: "ApiError", status: 503 });

    // 不同 id 归一化成同一条路由，共用一份配额。
    for (let i = 0; i < 10; i += 1) {
      reportApiFailure(outage, { path: `/admin/users/${i}`, method: "GET" }, client);
    }
    expect(captured).toHaveLength(3);

    // 另一条接口 / 另一种失败各有自己的配额。
    reportApiFailure(outage, { path: "/admin/dashboard", method: "GET" }, client);
    reportApiFailure(new TypeError("Failed to fetch"), { path: "/admin/users/1", method: "GET" }, client);
    expect(captured).toHaveLength(5);

    // 一次页面生命周期内不会自动恢复；只有刷新（这里用测试重置）才会。
    reportApiFailure(outage, { path: "/admin/users/99", method: "GET" }, client);
    expect(captured).toHaveLength(5);
    resetSentryForTests();
    reportApiFailure(outage, { path: "/admin/users/99", method: "GET" }, client);
    expect(captured).toHaveLength(6);
  });
});
