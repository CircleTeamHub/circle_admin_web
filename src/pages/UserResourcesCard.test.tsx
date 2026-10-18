import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { getUserResources } from "../api/user-resources";
import { UserResourcesCard } from "./UserResourcesCard";
vi.mock("../api/user-resources", () => ({ getUserResources: vi.fn() }));
function show(
  permissions: AdminPermission[] = ["COMMUNITY_MANAGE", "MODERATION_MANAGE"],
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
        <MemoryRouter>
          <UserResourcesCard userID="user-1" />
        </MemoryRouter>
      </QueryClientProvider>
    </AdminAccessContext.Provider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUserResources).mockImplementation(async (_user, kind, page) => ({
    items:
      kind === "circles"
        ? [
            {
              id: "membership-id",
              role: "OWNER",
              createdAt: "2026-10-01",
              circle: {
                id: "circle-id",
                name: "摄影圈",
                deleted: false,
                memberCount: 12,
                postCount: 3,
                adminState: "ACTIVE",
              },
            },
          ]
        : kind === "groups"
          ? [
              {
                id: "seat-id",
                joinedAt: "2026-10-01",
                group: {
                  id: "actual-group-id",
                  name: "朋友群",
                  memberCount: 4,
                  circle: null,
                },
              },
            ]
          : kind === "posts"
            ? [
                {
                  id: "post-id",
                  content: "我的动态",
                  status: "ENDED",
                  createdAt: "2026-10-01",
                  circle: { id: "circle-id", name: "摄影圈" },
                },
              ]
            : [
                {
                  id: "note-id",
                  title: "旅行笔记",
                  status: "ACTIVE",
                  available: true,
                  workStatus: null,
                  imageCount: 2,
                  videoCount: 1,
                  audioCount: 0,
                  isCollected: true,
                  createdAt: "2026-10-01",
                  updatedAt: "2026-10-02",
                },
              ],
    total: 21,
    page,
    limit: 20,
  }));
});
it("paginates each resource and links names to scoped details without displaying internal IDs", async () => {
  show();
  expect(await screen.findByRole("link", { name: "摄影圈" })).toHaveAttribute(
    "href",
    "/community/circles/circle-id",
  );
  expect(screen.queryByText("membership-id")).toBeNull();
  expect(getUserResources).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() =>
    expect(getUserResources).toHaveBeenCalledWith("user-1", "circles", 2),
  );
  fireEvent.click(screen.getByRole("tab", { name: "加入的群聊" }));
  expect(await screen.findByRole("link", { name: "朋友群" })).toHaveAttribute(
    "href",
    "/community/groups/actual-group-id",
  );
  expect(getUserResources).toHaveBeenCalledWith("user-1", "groups", 1);
  fireEvent.click(screen.getByRole("tab", { name: "发布的动态" }));
  expect(await screen.findByRole("link", { name: "我的动态" })).toHaveAttribute(
    "href",
    "/users/user-1/posts/post-id",
  );
  expect(screen.getByText("已结束")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "用户笔记" }));
  expect(await screen.findByRole("link", { name: "旅行笔记" })).toHaveAttribute(
    "href",
    "/users/user-1/notes/note-id",
  );
  expect(screen.getByText(/收藏副本 · 2 张图片/)).toBeVisible();
});
it("does not request or offer content outside the current administrator permissions", () => {
  show([]);
  expect(screen.queryByRole("tab")).toBeNull();
  expect(getUserResources).not.toHaveBeenCalled();
  expect(screen.getByText(/需要圈子管理或内容审核权限/)).toBeVisible();
});
it("shows errors and allows retry instead of treating unavailable data as an empty list", async () => {
  vi.mocked(getUserResources).mockRejectedValue(new Error("unavailable"));
  show();
  expect(await screen.findByRole("button", { name: /重\s*试/ })).toBeVisible();
  expect(screen.queryByText("暂无记录")).toBeNull();
});
