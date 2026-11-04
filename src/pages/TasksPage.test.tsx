import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { TasksPage } from "./TasksPage";
import { consoleApi } from "../api/console";
vi.mock("../auth/admin-access", () => ({
  useAdminAccess: () => ({ hasPermission: () => true }),
}));
vi.mock("../api/console", () => ({
  consoleApi: { overview: vi.fn(), tasks: vi.fn() },
  consoleWrite: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(consoleApi.overview).mockResolvedValue({
    generatedAt: "2026-10-17T00:00:00Z",
    items: [],
    groupOperations: [],
  });
});
function show(path = "/tasks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <TasksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("shows the notification, recipient link and result without an obsolete completed schedule", async () => {
  vi.mocked(consoleApi.tasks).mockResolvedValue({
    kind: "notification_push",
    nextCursor: null,
    items: [
      {
        id: "task-123456",
        status: "COMPLETED",
        attempts: 1,
        nextAttemptAt: "2026-11-01T00:00:00Z",
        lastError: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
        notification: {
          type: "FRIEND_REQUEST_RECEIVED",
          toUserID: "user-123",
          toUser: { id: "user-123", nickname: "测试接收者" },
        },
        deliveryCounts: { SENT: 2, TERMINAL: 1 },
      },
    ],
  });
  show();
  await screen.findByText("收到好友申请");
  const row = screen.getByRole("row", { name: /收到好友申请/ });
  expect(
    within(row).getByRole("link", { name: "测试接收者" }).getAttribute("href"),
  ).toBe("/users/user-123");
  expect(row.textContent).not.toContain("渠道已接受 2 条");
  expect(
    within(row).getByRole("link", { name: "查看推送详情" }),
  ).toHaveAttribute("href", "/push-operations?taskID=task-123456");
  expect(
    screen.queryByRole("columnheader", { name: "处理结果" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "重试" }),
  ).not.toBeInTheDocument();
  expect(row.textContent).not.toContain("2026/11/01");
});
it("explains unavailable records and missing device deliveries without claiming receipt", async () => {
  vi.mocked(consoleApi.tasks).mockResolvedValue({
    kind: "notification_push",
    nextCursor: null,
    items: [
      {
        id: "task-missing",
        status: "COMPLETED",
        attempts: 1,
        nextAttemptAt: null,
        lastError: null,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
        notification: null,
        deliveryCounts: {},
      },
    ],
  });
  show();
  await screen.findByText("通知记录不可用");
  expect(screen.getByText("未指定接收用户")).toBeTruthy();
  expect(screen.getByRole("link", { name: "查看推送详情" })).toHaveAttribute(
    "href",
    "/push-operations?taskID=task-missing",
  );
});
it("routes failed retryable notifications to push operations instead of retrying in task center", async () => {
  vi.mocked(consoleApi.tasks).mockResolvedValue({kind:"notification_push",nextCursor:null,items:[{id:"failed-task",status:"FAILED",retryable:true,attempts:3,lastError:"TIMEOUT",createdAt:"2026-10-17",updatedAt:"2026-10-17",nextAttemptAt:null,notification:{type:"SYSTEM",toUserID:null}}]});
  show();
  expect(await screen.findByRole("link",{name:"查看推送详情"})).toHaveAttribute("href","/push-operations?taskID=failed-task");
  expect(screen.queryByRole("button",{name:/重试/})).not.toBeInTheDocument();
});

it("shows exhausted group failures without promising or scheduling automatic retry", async () => {
  vi.mocked(consoleApi.tasks).mockResolvedValue({
    kind: "group_operation", nextCursor: null, items: [{
      id: "failed-group", status: "FAILED", retryable: false, attempts: 5, lastError: null,
      nextAttemptAt: "2026-11-01T00:00:00Z", createdAt: "2026-10-17", updatedAt: "2026-10-17",
    }],
  });
  show("/tasks?kind=group_operation");
  expect(await screen.findByText("处理失败，不再自动重试")).toBeInTheDocument();
  const row = screen.getByRole("row", { name: /处理失败/ });
  expect(row.textContent).not.toContain("2026/11/01");
});

it("shows succeeded group operations with completion text and success color", async () => {
  vi.mocked(consoleApi.tasks).mockResolvedValue({
    kind: "group_operation", nextCursor: null, items: [{
      id: "succeeded-group", status: "SUCCEEDED", attempts: 1, lastError: null,
      nextAttemptAt: "2026-11-01T00:00:00Z", createdAt: "2026-10-17", updatedAt: "2026-10-17",
    }],
  });
  show("/tasks?kind=group_operation");
  expect(await screen.findByText("执行成功")).toHaveClass("ant-tag-success");
  const row = screen.getByRole("row", { name: /执行成功/ });
  expect(within(row).getByText("后台处理完成")).toBeInTheDocument();
  expect(row.textContent).not.toContain("2026/11/01");
});
