import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { consoleApi } from "../api/console";
import { AdminAccessContext } from "../auth/admin-access";
import { DiagnosticsPage, UserEventsPage } from "./DiagnosticsPage";
import { diagnosticResult } from "./diagnostics-presentation";
vi.mock("../api/console", () => ({
  consoleApi: { diagnostics: vi.fn(), events: vi.fn() },
}));
const audit = {
  id: "record-secret-id",
  actorID: "actor-id",
  actor: { id: "actor-id", nickname: "管理员小明", accountId: "admin" },
  action: "console.request.failed",
  requestRoute:"/api/v1/admin/console/tasks",
  requestMethod:"GET",
  entityType: "http_request",
  entityID: null,
  reason: null,
  requestId: "request-secret-id",
  failureStatus: 403,
  createdAt: "2026-10-17T00:00:00Z",
};
function show(entry = "/diagnostics") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[entry]}>
        <AdminAccessContext.Provider
          value={{
            role: "SUPER_ADMIN",
            permissions: ["AUDIT_READ", "USER_READ"],
            version: 1,
          }}
        >
          <Routes>
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/user-events" element={<UserEventsPage />} />
          </Routes>
        </AdminAccessContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(consoleApi.diagnostics).mockResolvedValue({
    items: [audit],
    nextCursor: "next",
  });
  vi.mocked(consoleApi.events).mockResolvedValue({
    items: [
      {
        id: "event-id",
        userID: "user-id",
        user: { id: "user-id", nickname: "用户小红", accountId: "xiaohong" },
        name: "APP_OPEN",
        source: "CLIENT",
        platform: "ios",
        appVersion: "1.2.3",
        entityType: null,
        entityID: null,
        createdAt: audit.createdAt,
      },
    ],
    nextCursor: null,
  });
});
it("shows names, useful results and advice while reserving internal codes for details", async () => {
  show();
  expect(await screen.findByText("管理员小明")).toHaveAttribute(
    "href",
    "/users/actor-id",
  );
  expect(screen.getByText("权限不足")).toBeInTheDocument();
  expect(
    screen.getAllByText("联系超级管理员检查当前账号的功能权限。")[0],
  ).toBeInTheDocument();
  expect(screen.queryByText("record-secret-id")).not.toBeInTheDocument();
  expect(screen.queryByText("request-secret-id")).not.toBeInTheDocument();
  expect(screen.queryByText("console.request.failed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "查看详情" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText("console.request.failed"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("request-secret-id")).toBeInTheDocument();
  expect(within(dialog).getByText("HTTP 403")).toBeInTheDocument();
  expect(within(dialog).getByText("加载后台任务列表失败")).toBeInTheDocument();
  expect(within(dialog).getByText(/不代表通知发送或后台任务本身执行失败/)).toBeInTheDocument();
});
it("keeps diagnostics separate from events and preserves the linked request filter", async () => {
  show("/diagnostics?requestID=linked-id&name=APP_OPEN");
  await screen.findByText("管理员小明");
  expect(vi.mocked(consoleApi.diagnostics).mock.calls[0][0].get("requestID")).toBe("linked-id");
  expect(vi.mocked(consoleApi.diagnostics).mock.calls[0][0].has("name")).toBe(false);
  expect(consoleApi.events).not.toHaveBeenCalled();
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", {name:"问题排查"})).toBeInTheDocument();
});
it("shows user behavior on its own page without loading audit records", async () => {
  show("/user-events?name=APP_OPEN");
  expect(await screen.findByText("用户小红")).toBeInTheDocument();
  expect(screen.getByRole("heading", {name:"用户行为记录"})).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "App 活跃" })).toBeInTheDocument();
  expect(consoleApi.diagnostics).not.toHaveBeenCalled();
  expect(vi.mocked(consoleApi.events).mock.calls[0][0].get("name")).toBe("APP_OPEN");
});
it("redirects old event bookmarks to the independent user-behavior page", async () => {
  show("/diagnostics?mode=events&name=APP_OPEN&requestID=obsolete");
  expect(await screen.findByText("用户小红")).toBeInTheDocument();
  expect(consoleApi.diagnostics).not.toHaveBeenCalled();
  const params=vi.mocked(consoleApi.events).mock.calls[0][0];
  expect(params.get("name")).toBe("APP_OPEN");
  expect(params.has("requestID")).toBe(false);
});
it("clears a failed query through retry and does not pretend the failure is an empty result", async () => {
  vi.mocked(consoleApi.diagnostics).mockRejectedValueOnce(new Error("offline"));
  show();
  const retry = await screen.findByRole("button", { name: /重\s*试/ });
  expect(screen.queryByText("暂无失败记录")).not.toBeInTheDocument();
  fireEvent.click(retry);
  await screen.findByText("管理员小明");
});
it("explains an unmatched diagnostic number and lets the operator clear it", async () => {
  vi.mocked(consoleApi.diagnostics).mockResolvedValue({
    items: [],
    nextCursor: null,
  });
  show("/diagnostics?requestID=missing");
  await screen.findByText(/没有找到这个编号/);
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  await waitFor(() =>
    expect(
      vi.mocked(consoleApi.diagnostics).mock.lastCall?.[0].has("requestID"),
    ).toBe(false),
  );
});
it.each([
  [401, "登录已失效"],
  [403, "权限不足"],
  [404, "记录或接口不存在"],
  [429, "操作过于频繁"],
  [503, "服务处理异常"],
  [400, "请求未完成"],
  [null, "请求失败"],
] as const)("explains HTTP %s accurately", (status, label) => {
  expect(diagnosticResult("console.request.failed", status).label).toBe(label);
});
it("does not label ordinary audit events as successful or failed requests", () => {
  expect(diagnosticResult("admin.login.success").label).toBe("操作记录");
  expect(diagnosticResult("ADMIN_GROUP_OPERATION_FAILED").label).toBe(
    "操作失败",
  );
});

it("shows the failed operation and does not invent causes for legacy 500 records",async()=>{
 vi.mocked(consoleApi.diagnostics).mockResolvedValue({items:[{...audit,failureStatus:500}],nextCursor:null});show();
 expect(await screen.findByText("加载后台任务列表失败")).toBeInTheDocument();
 expect(screen.getByText("当时只记录了服务器错误，未保存具体原因。")).toBeInTheDocument();
});
it("explains a categorized database query error without showing raw exception text",async()=>{
 vi.mocked(consoleApi.diagnostics).mockResolvedValue({items:[{...audit,failureStatus:500,failureCause:"DATABASE_QUERY_INVALID"}],nextCursor:null});show();
 expect(await screen.findByText("数据库查询参数不符合程序要求，属于程序查询错误。")).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"查看详情"}));
 expect(await screen.findByText("请联系开发人员修复查询参数，反复点击通常无法解决。")).toBeInTheDocument();
});
