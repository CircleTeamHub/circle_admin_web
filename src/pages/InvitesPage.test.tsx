import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Modal } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { platformList, platformWrite, type Campaign } from "../api/platform";
import { AdminAccessContext } from "../auth/admin-access";
import { InvitesPage } from "./InvitesPage";

vi.mock("../api/platform", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/platform")>(),
  platformList: vi.fn(), platformWrite: vi.fn(),
}));

afterEach(() => Modal.destroyAll());
beforeEach(() => vi.resetAllMocks());

async function confirmWrite() {
  const titles = await screen.findAllByText("确认修改邀请码配置");
  // AntD gives every test modal the same title ID; scope by its visible text.
  const dialog = titles[0].closest<HTMLElement>('[role="dialog"]')!;
  fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
}

it.each([false, true])("refreshes campaign settings and version together after a conflict (failed refresh first: %s)", async (failedRefreshFirst) => {
  const campaign: Campaign = {
    id: "campaign", code: "TEST", name: "测试活动",
    owner: { id: "owner", accountId: "test-owner", nickname: "测试邀请人" },
    enabled: true, usedCount: 0, maxUses: 100, expiresAt: "2027-01-01T00:00:00Z", version: 1,
  };
  const refreshed = { ...campaign, enabled: false, maxUses: 5, expiresAt: "2028-01-01T00:00:00Z", version: 2 };
  let campaignReads = 0;
  vi.mocked(platformList).mockImplementation(async (path) => ({
    items: path.endsWith("campaign-invites") ? [++campaignReads === 1 ? campaign : refreshed] : [],
    total: path.endsWith("campaign-invites") ? 1 : 0, page: 1, limit: 20,
  }));
  vi.mocked(platformWrite).mockRejectedValueOnce(new ApiError("版本冲突", 409)).mockResolvedValueOnce({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AdminAccessContext.Provider value={{ role: "SUPER_ADMIN", permissions: ["CONTENT_MANAGE"], version: 1 }}>
      <QueryClientProvider client={client}>
        <InvitesPage />
      </QueryClientProvider>
    </AdminAccessContext.Provider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "活动邀请码" }));
  fireEvent.click(await screen.findByRole("button", { name: "编辑 / 启停" }));
  const editor = screen.getByRole("dialog", { name: "编辑活动邀请码" });
  const fields = within(editor);
  expect(fields.getByRole("switch", { name: "启用" })).toBeChecked();
  expect(fields.getByLabelText("使用上限")).toHaveValue("100");
  expect(Date.parse((fields.getByLabelText("有效期") as HTMLInputElement).value)).toBe(Date.parse(campaign.expiresAt));
  fireEvent.change(fields.getByLabelText("原因"), { target: { value: "确认配置" } });
  fireEvent.click(fields.getByRole("button", { name: "OK" }));
  await confirmWrite();
  const refresh = await fields.findByRole("button", { name: "刷新版本后重新确认" });
  expect(platformWrite).toHaveBeenCalledTimes(1);
  expect(fields.getByRole("button", { name: "OK" })).toBeDisabled();
  if (failedRefreshFirst) {
    vi.mocked(platformList).mockRejectedValueOnce(new Error("刷新失败"));
    fireEvent.click(refresh);
    await waitFor(() => expect(client.getQueryState(["invite-campaigns", 1, ""])?.status).toBe("error"));
    expect(fields.getByRole("button", { name: "刷新版本后重新确认" })).toBeVisible();
    expect(fields.getByRole("button", { name: "OK" })).toBeDisabled();
    expect(fields.getByRole("switch", { name: "启用" })).toBeChecked();
    expect(fields.getByLabelText("使用上限")).toHaveValue("100");
    expect(platformWrite).toHaveBeenCalledTimes(1);
  }
  fireEvent.click(refresh);
  await waitFor(() => expect(fields.queryByRole("button", { name: "刷新版本后重新确认" })).not.toBeInTheDocument());
  expect(fields.getByRole("switch", { name: "启用" })).not.toBeChecked();
  expect(fields.getByLabelText("使用上限")).toHaveValue("5");
  expect(Date.parse((fields.getByLabelText("有效期") as HTMLInputElement).value)).toBe(Date.parse(refreshed.expiresAt));

  fireEvent.click(fields.getByRole("button", { name: "OK" }));
  await confirmWrite();
  await waitFor(() => expect(platformWrite).toHaveBeenCalledTimes(2));
  const [path, method, body, key] = vi.mocked(platformWrite).mock.calls[1];
  expect([path, method, key]).toEqual(["/admin/operations/campaign-invites/campaign", "PATCH", undefined]);
  expect(body).toEqual({ enabled: false, maxUses: 5, expiresAt: expect.any(String), reason: "确认配置", version: 2 });
  expect(Date.parse((body as { expiresAt: string }).expiresAt)).toBe(Date.parse(refreshed.expiresAt));
});
