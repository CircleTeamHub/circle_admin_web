import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearSession, getSession, setSession } from "../auth/session";
import { grantMembership } from "./admin-commerce";
import { reviewReport } from "./moderation";

const originalFetch = globalThis.fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  clearSession();
  setSession({ accessToken: "old-access", refreshToken: "refresh-token" });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearSession();
});

// 管理员访问令牌 15 分钟过期。写操作遇到 401 时请求还没进到处理函数(鉴权守卫拒的),
// 刷新后重发不会重复执行;不刷新的话就是一个假的「登录已失效」,再点一次又好。
it.each([
  ["membership grant", () => grantMembership("user-1", { targetLevel: 1 } as never)],
  ["report review", () => reviewReport("group" as never, "report-1", "APPROVE" as never)],
])("refreshes and replays a %s after the access token expired", async (_name, write) => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ code: 401, message: "Unauthorized", data: null }, 401))
    .mockResolvedValueOnce(
      json({ code: 0, message: "ok", data: { accessToken: "new-access", refreshToken: "new-refresh" } }),
    )
    .mockResolvedValueOnce(json({ code: 0, message: "ok", data: { ok: true } }));
  globalThis.fetch = fetchMock;

  await expect(write()).resolves.toEqual({ ok: true });

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(String(fetchMock.mock.calls[1][0])).toContain("/auth/admin/refresh");
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer new-access");
  expect(getSession()?.accessToken).toBe("new-access");
});
