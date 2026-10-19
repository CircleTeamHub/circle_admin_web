import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getAdminGroup,
  getAdminGroupMembers,
  getAdminGroupEvents,
  type AdminGroupDetail,
} from "../api/community";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { GroupDetailPage, groupEventDescription } from "./GroupDetailPage";
vi.mock("../api/community", () => ({
  getAdminGroup: vi.fn(),
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
  textEncryption: "MLS_V1",
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
        <MemoryRouter initialEntries={["/community/groups/group-id"]}>
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
  expect(screen.getByText("已启用端到端加密")).toBeVisible();
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
