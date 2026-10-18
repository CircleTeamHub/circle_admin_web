import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getAdminCircle,
  getAdminCircleMembers,
  getAdminCirclePosts,
  type AdminCircleDetail,
} from "../api/community";
import { CircleDetailPage } from "./CircleDetailPage";
vi.mock("../api/community", () => ({
  getAdminCircle: vi.fn(),
  getAdminCircleMembers: vi.fn(),
  getAdminCirclePosts: vi.fn(),
}));
const detail: AdminCircleDetail = {
  id: "circle-identifier",
  name: "摄影圈",
  description: "学习摄影和交流作品",
  rules: "不得刷屏",
  avatarUrl: null,
  cover: null,
  currentIconUrl: null,
  cities: ["成都"],
  categories: ["摄影"],
  tags: ["胶片"],
  isPublic: true,
  joinVipRestriction: 2,
  joinCreditRestriction: 80,
  joinFancyRestriction: true,
  maxMembers: 200,
  expansionSeats: 50,
  memberCanPost: false,
  memberCanInvite: true,
  requiredVerifierCount: 3,
  memberCount: 12,
  postCount: 2,
  deleted: false,
  adminState: "ACTIVE",
  adminDisabledAt: null,
  adminDisabledBy: null,
  adminDisableReason: null,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  owner: {
    id: "owner",
    nickname: "圈主小明",
    accountId: "xiaoming",
    avatarUrl: null,
  },
  associatedGroup: {
    id: "chat-identifier",
    name: null,
    muteAllAt: null,
    textEncryption: "MLS_V1",
    qrJoinEnabled: false,
    cardJoinEnabled: true,
    joinApprovalRequired: true,
    membersCanViewProfiles: false,
    membersCanViewRoster: true,
    membersCanAddFriends: true,
  },
};
function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/community/circles/circle-identifier"]}>
        <Routes>
          <Route
            path="/community/circles/:circleId"
            element={<CircleDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAdminCircle).mockResolvedValue(detail);
  vi.mocked(getAdminCircleMembers).mockResolvedValue({
    items: [
      {
        id: "member",
        role: "OWNER",
        status: "ACTIVE",
        createdAt: detail.createdAt,
        user: detail.owner,
      },
    ],
    total: 21,
    page: 1,
    limit: 20,
  });
  vi.mocked(getAdminCirclePosts).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });
});
it("shows App circle fields, actual group settings, and keeps full identifiers collapsed", async () => {
  renderPage();
  await screen.findByText("学习摄影和交流作品");
  for (const text of [
    "不得刷屏",
    "成都",
    "摄影",
    "胶片",
    "200 人",
    "3 人",
    "已启用端到端加密",
    "仅圈主和管理员可发布",
  ])
    expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.queryByText(detail.id)).toBeNull();
  expect(getAdminCircleMembers).not.toHaveBeenCalled();
  expect(getAdminCirclePosts).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("内部编号（排查使用）"));
  expect(await screen.findByText(detail.id)).toBeVisible();
  expect(screen.getByText("chat-identifier")).toBeVisible();
});
it("loads members on demand and fetches later pages instead of truncating the roster", async () => {
  renderPage();
  await screen.findByText("学习摄影和交流作品");
  fireEvent.click(screen.getByRole("tab", { name: "成员与申请" }));
  expect(await screen.findByText("已入圈")).toBeInTheDocument();
  expect(screen.getByText("圈主", { exact: true })).toBeVisible();
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() =>
    expect(getAdminCircleMembers).toHaveBeenCalledWith(detail.id, 2),
  );
  fireEvent.click(screen.getByRole("tab", { name: "圈子动态" }));
  expect(await screen.findByText("暂无动态")).toBeVisible();
  expect(getAdminCirclePosts).toHaveBeenCalledWith(detail.id, 1);
});
it("shows a retryable error instead of inventing missing circle data", async () => {
  vi.mocked(getAdminCircle).mockRejectedValue(new Error("unavailable"));
  renderPage();
  expect(await screen.findByRole("button", { name: /重\s*试/ })).toBeVisible();
  expect(screen.queryByText("正常", { exact: true })).toBeNull();
  expect(screen.getByRole("link", { name: "返回圈子列表" })).toHaveAttribute(
    "href",
    "/community",
  );
});

it("shows complete post content, media and historical status with separate post pagination", async () => {
  vi.mocked(getAdminCirclePosts).mockResolvedValue({
    items: [
      {
        id: "post-id",
        content: "完整动态正文",
        images: ["https://example.test/photo.jpg"],
        tags: ["作品"],
        city: null,
        cities: ["成都"],
        isHorn: false,
        noteID: null,
        status: "DELETED",
        viewCount: 8,
        signupCount: 2,
        vipRestriction: 2,
        creditRestriction: null,
        fancyRestriction: false,
        signupVipRestriction: null,
        signupCreditRestriction: 80,
        signupFancyRestriction: true,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
        endedAt: null,
        expiresAt: null,
        author: detail.owner,
        circle: { id: detail.id, name: detail.name },
        circleLinks: [{ circle: { id: "another", name: "关联圈子" } }],
      },
    ],
    total: 21,
    page: 1,
    limit: 20,
  });
  renderPage();
  await screen.findByText("学习摄影和交流作品");
  fireEvent.click(screen.getByRole("tab", { name: "圈子动态" }));
  expect(await screen.findByText("完整动态正文")).toBeVisible();
  expect(screen.getByText("已删除")).toBeVisible();
  expect(screen.getByText("摄影圈、关联圈子")).toBeVisible();
  expect(screen.getByRole("img", { name: "动态图片 1" })).toHaveAttribute(
    "src",
    "https://example.test/photo.jpg",
  );
  expect(screen.queryByText("post-id")).toBeNull();
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() =>
    expect(getAdminCirclePosts).toHaveBeenCalledWith(detail.id, 2),
  );
});
