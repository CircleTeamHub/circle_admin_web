import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getUserNote,
  getUserPost,
  type AdminNoteDetail,
} from "../api/user-resources";
import { UserContentDetailPage, safeContentURL } from "./UserContentDetailPage";
vi.mock("../api/user-resources", () => ({
  getUserNote: vi.fn(),
  getUserPost: vi.fn(),
}));
const note: AdminNoteDetail = {
  id: "note-id",
  ownerId: "user-1",
  title: "旅行笔记",
  status: "ACTIVE",
  available: true,
  workStatus: null,
  remark: "作者备注",
  createdAt: "2026-10-01",
  updatedAt: "2026-10-02",
  content: "旧文字",
  contentJson: null,
  groups: [{ id: "category", name: "旅行" }],
  media: [
    {
      id: "image",
      type: "IMAGE",
      url: "https://example.test/private-signed.jpg",
      objectKey: "notes/image",
    },
    {
      id: "audio",
      type: "AUDIO",
      url: "https://example.test/voice.mp3",
      objectKey: "notes/voice",
    },
  ],
  sections: {
    text: {
      content: null,
      contentJson: [
        { type: "heading", content: [{ type: "text", text: "旅行计划" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "完整正文" },
            {
              type: "link",
              href: "javascript:alert(1)",
              content: [{ type: "text", text: "不安全链接" }],
            },
          ],
        },
      ],
    },
    media: { items: [] },
    showcase: { items: [] },
    contacts: { items: [] },
    groups: { items: [] },
    location: { title: "公园", address: "示例地址" },
  },
};
function show(kind: "notes" | "posts" = "notes") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/users/user-1/${kind}/resource-id`]}>
        <Routes>
          <Route
            path="/users/:userId/:kind/:resourceId"
            element={<UserContentDetailPage kind={kind} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUserNote).mockResolvedValue(note);
});
it("renders full note blocks and signed media, not raw JSON or executable HTML", async () => {
  const view = show();
  expect(
    await screen.findByRole("heading", { name: "旅行计划" }),
  ).toBeVisible();
  expect(screen.getByText("完整正文")).toBeVisible();
  expect(screen.getByRole("img", { name: "笔记图片" })).toHaveAttribute(
    "src",
    "https://example.test/private-signed.jpg",
  );
  expect(view.container.querySelector("audio")).toHaveAttribute("controls");
  expect(screen.getByText("不安全链接")).toBeVisible();
  expect(screen.queryByRole("link", { name: "不安全链接" })).toBeNull();
  expect(screen.getByText("示例地址")).toBeVisible();
  expect(screen.getByRole("link", { name: "返回用户详情" })).toHaveAttribute(
    "href",
    "/users/user-1",
  );
  expect(getUserNote).toHaveBeenCalledWith("user-1", "resource-id");
});
it("keeps a failed or missing note separate from valid content and offers retry", async () => {
  vi.mocked(getUserNote).mockRejectedValue(new Error("not found"));
  show();
  expect(await screen.findByRole("button", { name: /重\s*试/ })).toBeVisible();
  expect(screen.queryByText("旅行计划")).toBeNull();
});
it("supports scoped full post details", async () => {
  vi.mocked(getUserPost).mockResolvedValue({
    id: "post",
    content: "完整动态正文",
    images: [],
    tags: [],
    city: null,
    cities: [],
    isHorn: false,
    noteID: null,
    status: "ACTIVE",
    viewCount: 1,
    signupCount: 0,
    vipRestriction: null,
    creditRestriction: null,
    fancyRestriction: false,
    signupVipRestriction: null,
    signupCreditRestriction: null,
    signupFancyRestriction: false,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    endedAt: null,
    expiresAt: null,
    author: {
      id: "user-1",
      accountId: "ming",
      nickname: "小明",
      avatarUrl: null,
    },
    circle: { id: "circle", name: "摄影圈" },
    circleLinks: [],
  });
  show("posts");
  expect(await screen.findByText("完整动态正文")).toBeVisible();
  expect(getUserPost).toHaveBeenCalledWith("user-1", "resource-id");
});
it("rejects executable and local file media URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "file:///private/test",
  ])
    expect(safeContentURL(url)).toBeUndefined();
  expect(safeContentURL("https://example.test/image")).toBe(
    "https://example.test/image",
  );
});
