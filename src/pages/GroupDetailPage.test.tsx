import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getAdminGroup,
  listAdminGroups,
  requestGroupOperation,
  getAdminGroupMembers,
  getAdminGroupEvents,
  type AdminGroupDetail,
} from "../api/community";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { GroupDetailPage, groupEventDescription } from "./GroupDetailPage";
vi.mock("../api/community", () => ({
  getAdminGroup: vi.fn(),
  listAdminGroups: vi.fn(),
  requestGroupOperation: vi.fn(),
  getAdminGroupMembers: vi.fn(),
  getAdminGroupEvents: vi.fn(),
}));
vi.mock("./ImPage", () => ({
  ConversationHistory: () => <div>需要访问原因与设备解密的聊天记录面板</div>,
}));
const group: AdminGroupDetail = {
  id: "group-id",
  type: "GROUP",
  name: "朋友群",
  circleID: null,
  circle: null,
  notice: "讨论摄影作品",
  avatarUrl: null,
  ownerID: "owner-id",
  owner: {
    id: "owner-id",
    accountId: "ming",
    nickname: "小明",
    avatarUrl: null,
  },
  memberCount: 25,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  lastMessageAt: null,
  muteAllAt: null,
  memberCanInvite: true,
  qrJoinEnabled: false,
  cardJoinEnabled: true,
  joinApprovalRequired: true,
  membersCanViewProfiles: false,
  membersCanViewRoster: true,
  membersCanAddFriends: false,
};
function show(
  permissions: AdminPermission[] = ["COMMUNITY_MANAGE", "USER_READ", "IM_READ"],
  initialEntry = "/community/groups/group-id",
) {
  render(
    <AdminAccessContext.Provider
      value={{ role: "SUPER_ADMIN", permissions, version: 1 }}
    >
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/community/groups/:conversationId"
              element={<GroupDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AdminAccessContext.Provider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listAdminGroups).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  vi.mocked(getAdminGroup).mockResolvedValue(group);
  vi.mocked(getAdminGroupMembers).mockResolvedValue({
    items: [
      {
        id: "seat-id",
        userID: "owner-id",
        role: "OWNER",
        alias: "老朋友",
        joinedAt: group.createdAt,
        leftAt: null,
        silencedAt: null,
        silencedUntil: null,
        user: group.owner,
      },
    ],
    page: 1,
    limit: 20,
    total: 21,
  });
  vi.mocked(getAdminGroupEvents).mockResolvedValue({
    items: [
      {
        id: "event",
        kind: "member-joined",
        actor: group.owner,
        targets: [],
        payload: { via: "qr" },
        createdAt: group.createdAt,
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
  });
});
it("shows group metadata and settings with hidden internal IDs and a working user detail link", async () => {
  show();
  expect(await screen.findByText("讨论摄影作品")).toBeVisible();
  expect(screen.getByText("25 人")).toBeVisible();
  // 文字加密已整体删除,群设置里不再有这一行。
  expect(screen.queryByText("文字加密")).toBeNull();
  expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute(
    "href",
    "/users/owner-id",
  );
  expect(screen.queryByText("group-id")).toBeNull();
  expect(getAdminGroupMembers).not.toHaveBeenCalled();
  expect(getAdminGroupEvents).not.toHaveBeenCalled();
  expect(screen.queryByText(/需要访问原因与设备解密/)).toBeNull();
  fireEvent.click(screen.getByText("内部编号（排查使用）"));
  expect(await screen.findByText("group-id")).toBeVisible();
});
it("loads complete member and event pages on demand and mounts the existing audited chat viewer only on selection", async () => {
  show();
  await screen.findByText("讨论摄影作品");
  fireEvent.click(screen.getByRole("tab", { name: "群成员" }));
  expect(await screen.findByText("老朋友")).toBeVisible();
  expect(screen.getByText("在群", { exact: true })).toBeVisible();
  expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute(
    "href",
    "/users/owner-id",
  );
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() =>
    expect(getAdminGroupMembers).toHaveBeenCalledWith("group-id", 2),
  );
  fireEvent.click(screen.getByRole("tab", { name: "群日志" }));
  expect(await screen.findByText("扫码入群")).toBeVisible();
  expect(screen.queryByText("member-joined")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "聊天记录" }));
  expect(await screen.findByText(/需要访问原因与设备解密/)).toBeVisible();
});
it("does not offer profile or chat content links without their respective permissions", async () => {
  show(["COMMUNITY_MANAGE"]);
  await screen.findByText("讨论摄影作品");
  expect(screen.queryByRole("link", { name: "小明" })).toBeNull();
  expect(screen.queryByRole("tab", { name: "聊天记录" })).toBeNull();
});
it("does not present unknown group event codes as success", () => {
  expect(
    groupEventDescription({
      id: "event",
      kind: "future-event",
      actor: null,
      targets: [],
      payload: null,
      createdAt: group.createdAt,
    }),
  ).toBe("群聊活动");
  expect(
    groupEventDescription({
      id: "event",
      kind: "policy-changed",
      actor: null,
      targets: [],
      payload: { policy: "qrJoinEnabled", enabled: false },
      createdAt: group.createdAt,
    }),
  ).toBe("修改群权限：扫码加入（已关闭）");
});

it("returns group details to the conversation list", async () => {
  show();
  expect(await screen.findByRole("link", { name: "返回会话与聊天记录" })).toHaveAttribute("href", "/im?type=GROUP");
});

it("opens the member list directly from the conversation count link", async () => {
  show(undefined, "/community/groups/group-id?tab=members");
  expect(await screen.findByText("老朋友")).toBeVisible();
  expect(screen.getByRole("tab", { name: "群成员" })).toHaveAttribute("aria-selected", "true");
  expect(getAdminGroupMembers).toHaveBeenCalledWith("group-id", 1);
});

it("falls back to group profile for a history deep link without IM_READ", async () => {
  show(["COMMUNITY_MANAGE"], "/community/groups/group-id?tab=history");
  expect(await screen.findByText("讨论摄影作品")).toBeVisible();
  expect(screen.getByRole("tab", { name: "群聊详情" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "聊天记录" })).toBeNull();
});
const manageable = (overrides = {}) => ({
  groupId: "operation-group-id", conversationId: "group-id", name: "朋友群", faceUrl: null, status: 0,
  muted: false, memberCount: 25, ownerUserId: null, ownerName: null, linkedCircle: null,
  pendingOperation: null, managementSupported: true, ...overrides,
});
function management(overrides = {}) {
  vi.mocked(listAdminGroups).mockResolvedValue({ items: [manageable(overrides)], total: 1, page: 1, limit: 20 });
}
it("restores audited dismissal for circle-linked groups and preserves the operation ID on retry", async () => {
  management({ linkedCircle: { id: "circle-id", name: "圈子" } });
  vi.mocked(requestGroupOperation).mockRejectedValueOnce(new Error("网络异常")).mockResolvedValueOnce({});
  show();
  fireEvent.click(await screen.findByRole("button", { name: "永久解散群聊" }));
  const dialog = screen.getByRole("dialog");
  expect(screen.queryByRole("button", { name: "全员禁言" })).toBeNull();
  expect(within(dialog).getByRole("button", { name: "确认提交" })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("群管理操作原因"), { target: { value: "违规处理" } });
  fireEvent.change(within(dialog).getByLabelText("确认群编号"), { target: { value: "operation-group-id" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "确认提交" }));
  await screen.findByText("网络异常");
  fireEvent.click(within(dialog).getByRole("button", { name: "确认提交" }));
  await waitFor(() => expect(requestGroupOperation).toHaveBeenCalledTimes(2));
  expect(vi.mocked(requestGroupOperation).mock.calls[0]).toEqual(["operation-group-id", "DISMISS", "违规处理", "operation-group-id", expect.any(String)]);
  expect(vi.mocked(requestGroupOperation).mock.calls[1]).toEqual(vi.mocked(requestGroupOperation).mock.calls[0]);
});
it.each([[false, "全员禁言", "MUTE"], [true, "解除全员禁言", "UNMUTE"]] as const)("restores supported group mute operations (%s)", async (muted, label, type) => {
  management({ muted });
  vi.mocked(requestGroupOperation).mockResolvedValue({});
  show();
  fireEvent.click(await screen.findByRole("button", { name: label }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("群管理操作原因"), { target: { value: "违规处理" } });
  fireEvent.change(within(dialog).getByLabelText("确认群编号"), { target: { value: "operation-group-id" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "确认提交" }));
  await waitFor(() => expect(requestGroupOperation).toHaveBeenCalledWith("operation-group-id", type, "违规处理", "operation-group-id", expect.any(String)));
});
it("blocks duplicate moderation while the backend operation is processing", async () => {
  management({ pendingOperation: { id: "op1", type: "MUTE", status: "PROCESSING", lastError: null } });
  show();
  expect(await screen.findByRole("button", { name: "全员禁言" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "永久解散群聊" })).toBeDisabled();
  expect(requestGroupOperation).not.toHaveBeenCalled();
});
it("does not offer moderation for groups marked unsupported by the backend", async () => {
  management({ managementSupported: false });
  show();
  await screen.findByText("讨论摄影作品");
  await waitFor(() => expect(listAdminGroups).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "永久解散群聊" })).toBeNull();
});
