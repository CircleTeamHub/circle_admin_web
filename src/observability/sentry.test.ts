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
});

describe("normalizePath", () => {
  it("collapses ids and drops the query string", () => {
    expect(normalizePath("/api/v1/users/42/notes/0f8fad5b-d9cb-469f-a165-70867728950e?x=1#y")).toBe(
      "/api/v1/users/:id/notes/:id",
    );
    expect(normalizePath("/system")).toBe("/system");
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
});
