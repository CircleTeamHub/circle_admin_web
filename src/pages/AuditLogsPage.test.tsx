import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AuditLogsPage } from "./AuditLogsPage";
import { platformList } from "../api/platform";
import { localDateTimeInput } from "./audit-presentation";
vi.mock("../api/platform", async (original) => ({
  ...(await original<typeof import("../api/platform")>()),
  platformList: vi.fn(),
}));
it("shows readable actions and allows full identifiers to be inspected in details", async () => {
  const requestId = "0576af4b-133f-4564-9321-7326761e28ae";
  vi.mocked(platformList).mockResolvedValue({
    items: [
      {
        id: "audit-1",
        actorID: "actor-1",
        actorAccountId: "admin",
        operator: null,
        action: "console.request.failed",
        entityType: "http_request",
        entityID: null,
        reason: null,
        requestId,
        createdAt: "2026-10-17T04:15:00Z",
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={["/audit-logs?from=2026-10-17T04%3A15%3A00Z"]}
      >
        <AuditLogsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText("后台请求失败");
  expect(screen.getByText("后台接口请求")).toBeTruthy();
  expect(screen.queryByText("0576af4b…")).toBeNull();
  expect(screen.getByRole("button", {name:"诊断详情"})).toBeTruthy();
  expect((screen.getByLabelText("开始") as HTMLInputElement).value).toBe(
    localDateTimeInput("2026-10-17T04:15:00Z"),
  );
  fireEvent.click(screen.getByRole("button", { name: "查看" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(requestId)).toBeTruthy();
  expect(within(dialog).getByText("console.request.failed")).toBeTruthy();
  expect(within(dialog).getAllByText("未记录").length).toBeGreaterThan(0);
});
