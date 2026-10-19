import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { PushOperationsPage } from "./PushOperationsPage";
import { consoleApi, consoleWrite } from "../api/console";
vi.mock("../api/console", () => ({
  consoleApi: {
    pushOverview: vi.fn(),
    pushes: vi.fn(),
    announcements: vi.fn(),
    devices: vi.fn(),
  },
  consoleWrite: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ content: false }));
beforeEach(() => { vi.clearAllMocks(); permissions.content = false; });
vi.mock("../auth/admin-access", () => ({
  useAdminAccess: () => ({
    hasPermission: (value: string) => value === "USER_READ" || (value === "CONTENT_MANAGE" && permissions.content),
  }),
}));
it("links to the actual recipient while keeping internal IDs out of the list", async () => {
  const id = "12345678-1234-5678-90ab-abcdef123456";
  vi.mocked(consoleApi.pushes).mockResolvedValue({
    items: [
      {
        id: "push",
        status: "COMPLETED",
        attempts: 1,
        lastError: null,
        nextAttemptAt: null,
        createdAt: "2026-10-17",
        updatedAt: "2026-10-17",
        notification: { toUserID: id, type: "SYSTEM" },
        deliveries: [],
      },
    ],
    nextCursor: null,
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <PushOperationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    (await screen.findByRole("link", { name: "查看用户" })).getAttribute(
      "href",
    ),
  ).toBe(`/users/${id}`);
  expect(screen.queryByText(id)).toBeNull();
  expect(screen.getByRole("heading", {name:"通知管理"})).toBeInTheDocument();
  expect(screen.queryByText(/SENT|CONFIRMED/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "用户详情" })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "错误类别" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "查看投递详情" }));
  expect(await screen.findByText("下次尝试")).toBeVisible();
});

function showTarget(taskID: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/push-operations?taskID=${taskID}`]}>
        <PushOperationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("locates the selected task, expands device details, and can return to all pushes", async () => {
  const taskID = "11111111-1111-4111-8111-111111111111";
  vi.mocked(consoleApi.pushes).mockResolvedValue({
    items: [
      {
        id: taskID,
        status: "COMPLETED",
        attempts: 1,
        lastError: null,
        nextAttemptAt: null,
        createdAt: "2026-10-17",
        updatedAt: "2026-10-17",
        notification: { toUserID: null, type: "SYSTEM" },
        deliveryCounts: { SENT: 2 },
        deliveries: [
          {
            id: "device-delivery",
            deviceID: null,
            platform: "ios",
            provider: "expo",
            status: "SENT",
            attempts: 1,
            lastError: null,
            sentAt: null,
            receiptCheckedAt: null,
          },
        ],
      },
    ],
    nextCursor: null,
  });
  showTarget(taskID);
  await screen.findByText("渠道已接受 2 条");
  expect(screen.getByText("历史设备（登记已清理）")).toBeInTheDocument();
  expect(vi.mocked(consoleApi.pushes).mock.lastCall?.[0].get("taskID")).toBe(
    taskID,
  );
  fireEvent.click(screen.getByRole("button", { name: "查看全部推送" }));
  await waitFor(() =>
    expect(vi.mocked(consoleApi.pushes).mock.lastCall?.[0].has("taskID")).toBe(
      false,
    ),
  );
});
it("explains when a linked task has been removed", async () => {
  vi.mocked(consoleApi.pushes).mockResolvedValue({
    items: [],
    nextCursor: null,
  });
  showTarget("11111111-1111-4111-8111-111111111111");
  expect(
    await screen.findByText("这条推送记录不存在或已清理，请返回查看全部推送。"),
  ).toBeInTheDocument();
});

it("only shows delivery records and diagnostics even for content administrators", async () => {
  permissions.content = true;
  vi.mocked(consoleApi.pushes).mockResolvedValue({ items: [], nextCursor: null });
  showTarget("11111111-1111-4111-8111-111111111111");
  await screen.findByText("这条推送记录不存在或已清理，请返回查看全部推送。");
  expect(screen.queryByText("给指定用户发送公告")).not.toBeInTheDocument();
  expect(screen.queryByText("手机通知设置")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "暂停推送" })).not.toBeInTheDocument();
  expect(consoleApi.announcements).not.toHaveBeenCalled();
  expect(consoleApi.pushOverview).not.toHaveBeenCalled();
});

it("clears the targeted task and all filters from the toolbar", async () => {
  vi.mocked(consoleApi.pushes).mockResolvedValue({ items: [], nextCursor: null });
  showTarget("11111111-1111-4111-8111-111111111111");
  fireEvent.click(await screen.findByRole("button", { name: "清空筛选" }));
  await waitFor(() => expect(vi.mocked(consoleApi.pushes).mock.lastCall?.[0].toString()).toBe(""));
});

it("preserves the failed-delivery retry action with an explicit reason", async () => {
  vi.mocked(consoleApi.pushes).mockResolvedValue({ items: [{
    id: "failed-push", status: "FAILED", retryable: true, attempts: 2, lastError: "NETWORK_ERROR", nextAttemptAt: null,
    createdAt: "2026-10-17", updatedAt: "2026-10-18", notification: { toUserID: null, type: "SYSTEM" }, deliveries: [],
  }], nextCursor: null });
  showTarget("failed-push");
  fireEvent.click(await screen.findByRole("button", { name: "重试失败设备" }));
  await waitFor(() => expect(screen.getByRole("dialog")).toBeVisible());
  expect(consoleWrite).not.toHaveBeenCalled();
});

it("does not offer retries for failures the backend marks ineligible", async () => {
  vi.mocked(consoleApi.pushes).mockResolvedValue({ items: [{
    id: "ineligible-push", status: "FAILED", retryable: false, attempts: 2, lastError: "NETWORK_ERROR", nextAttemptAt: null,
    createdAt: "2026-10-17", updatedAt: "2026-10-18", notification: { toUserID: null, type: "SYSTEM" }, deliveries: [],
  }], nextCursor: null });
  showTarget("ineligible-push");
  await screen.findByRole("button", { name: "收起详情" });
  expect(screen.queryByRole("button", { name: "重试失败设备" })).not.toBeInTheDocument();
  expect(consoleWrite).not.toHaveBeenCalled();
});
