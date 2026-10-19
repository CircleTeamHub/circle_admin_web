import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PushOperationsPage } from "./PushOperationsPage";
import { consoleApi } from "../api/console";
vi.mock("../api/console", () => ({
  consoleApi: {
    pushOverview: vi.fn(),
    pushes: vi.fn(),
    announcements: vi.fn(),
    devices: vi.fn(),
  },
  consoleWrite: vi.fn(),
}));
vi.mock("../auth/admin-access", () => ({
  useAdminAccess: () => ({
    hasPermission: (value: string) => value === "USER_READ",
  }),
}));
it("links to the actual recipient while keeping internal IDs out of the list", async () => {
  const id = "12345678-1234-5678-90ab-abcdef123456";
  vi.mocked(consoleApi.pushOverview).mockResolvedValue({
    providers: [],
    settings: { enabled: true, version: 1 },
    counts: [{status:"SENT",_count:1},{status:"CONFIRMED",_count:2}],
    receiptMeaning: "SENT 表示渠道接受；CONFIRMED 表示渠道回执成功",
  });
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
  expect(screen.getByText("渠道已接受：1")).toBeInTheDocument();
  expect(screen.getByText("回执已记录：2")).toBeInTheDocument();
  expect(screen.getByText(/都不代表用户已收到或已读/)).toBeInTheDocument();
  expect(screen.queryByText(/SENT|CONFIRMED/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "用户详情" })).toBeTruthy();
});

function showTarget(taskID: string) {
  vi.mocked(consoleApi.pushOverview).mockResolvedValue({
    providers: [],
    settings: { enabled: true, version: 1 },
    counts: [],
    receiptMeaning: "",
  });
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
