import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ImPage } from "./ImPage";
import { ApiError } from "../api/client";
import { listImConversations, queryImMessages } from "../api/admin-im";
vi.mock("../api/admin-im", () => ({
  listImConversations: vi.fn(),
  queryImMessages: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ archive: false, community: false }));
vi.mock("../auth/admin-access", () => ({
  useAdminAccess: () => ({
    hasPermission: (permission: string) => permission === "USER_READ" || (permission === "COMMUNITY_MANAGE" && permissions.community) || (permission === "IM_ARCHIVE_READ" && permissions.archive),
  }),
}));
vi.mock("../components/AdminEncryption", () => ({
  AdminEncryption: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  AdminEncryptedText: () => <span>加密文字待解锁</span>,
}));
const direct = {
  id: "direct-123456789",
  type: "DIRECT" as const,
  name: null,
  circleID: null,
  memberCount: 2,
  participants: [
    { id: "a", nickname: "小明" },
    { id: "b", nickname: "小红" },
  ],
  lastMessageAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  permissions.archive = false;
  permissions.community = false;
  vi.mocked(listImConversations).mockImplementation(async (_keyword, type) => ({
    items: [
      direct,
      {
        ...direct,
        id: "group-123456789",
        type: "GROUP" as const,
        name: "学习群",
        circleID: "circle-123456789",
        circle: { id: "circle-123456789", name: "学习圈" },
        memberCount: 10,
      },
    ].filter((conversation) => conversation.type === type),
    total: 1,
    sourceNote: "",
  }));
});
function show(initialEntry = "/im") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <ImPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("separates conversations without type, member-count or circle columns", async () => {
  show();
  await screen.findByText("小明 与 小红");
  expect(screen.queryByRole("columnheader", { name: "类型 / 人数" })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "所属圈子" })).not.toBeInTheDocument();
  expect(screen.queryByText("学习圈")).toBeNull();
  expect(listImConversations).toHaveBeenCalledWith("", "DIRECT", 1);
  fireEvent.click(screen.getByRole("tab", { name: "群聊" }));
  await screen.findByText("学习群");
  expect(screen.queryByText("小明 与 小红")).toBeNull();
  expect(listImConversations).toHaveBeenCalledWith("", "GROUP", 1);
  expect(screen.queryByText("学习圈")).not.toBeInTheDocument();
  expect(screen.queryByText("仅展示部分成员")).not.toBeInTheDocument();
  expect(screen.getByText("10 人")).toBeVisible();
  expect(screen.queryByRole("columnheader", { name: "最近消息时间" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "小明" })).not.toBeInTheDocument();
  expect(screen.queryByText("管理群成员")).toBeNull();
  expect(queryImMessages).not.toHaveBeenCalled();
});
it("opening and closing a conversation never automatically queries messages", async () => {
  show();
  await screen.findByText("小明 与 小红");
  fireEvent.click(
    within(screen.getByRole("row", { name: /小明 与 小红/ })).getByRole(
      "button",
      { name: "查看聊天记录" },
    ),
  );
  const panel = await screen.findByRole("dialog", { name: "聊天记录" });
  expect(within(panel).getByText("聊天记录 · 小明 与 小红")).toBeVisible();
  expect(screen.getByLabelText("访问原因")).toBeTruthy();
  expect(queryImMessages).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "关闭记录" }));
  expect(screen.queryByLabelText("访问原因")).toBeNull();
  expect(queryImMessages).not.toHaveBeenCalled();
});


it.each(['text', 'encrypted-text'])('removes an already displayed %s message when its per-message deadline passes', async (type) => {
  vi.mocked(queryImMessages).mockImplementation(async () => ({
    items: [{ id: 'ephemeral', height: 1, senderId: 'a', type, createdAt: new Date().toISOString(), visibleUntil: new Date(Date.now() + 300).toISOString(), mediaExpiresAt: null, content: { text: 'short lived private text' } }],
    nextCursor: null,
  }));
  show();
  await screen.findByText('小明 与 小红');
  fireEvent.click(within(screen.getByRole('row', { name: /小明 与 小红/ })).getByRole('button', { name: '查看聊天记录' }));
  fireEvent.change(screen.getByLabelText('访问原因'), { target: { value: '核查举报' } });
  fireEvent.click(screen.getByRole('button', { name: '审计并查询' }));
  const body = type === 'text' ? 'short lived private text' : '加密文字待解锁';
  expect(await screen.findByText(body)).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(body)).toBeNull(), { timeout: 2200 });
});


it('queries normal and retained messages through one audited history entry', async () => {
  permissions.archive = true;
  vi.mocked(queryImMessages).mockResolvedValue({ items: [], nextCursor: null });
  show();
  await screen.findByText('小明 与 小红');
  fireEvent.click(within(screen.getByRole('row', { name: /小明 与 小红/ })).getByRole('button', { name: '查看聊天记录' }));
  expect(queryImMessages).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('访问原因'), { target: { value: '核查举报' } });
  fireEvent.click(screen.getByRole('button', { name: '审计并查询' }));
  await waitFor(() => expect(queryImMessages).toHaveBeenCalledWith(direct.id, { reason: '核查举报' }, true));
  expect(queryImMessages).toHaveBeenCalledWith(direct.id, { reason: '核查举报' }, false);
  expect(screen.queryByRole('button', { name: '焚毁留存（180天）' })).not.toBeInTheDocument();
});

it("closes the private history panel when switching to groups", async () => {
  show();
  fireEvent.click(within(await screen.findByRole("row", { name: /小明 与 小红/ })).getByRole("button", { name: "查看聊天记录" }));
  expect(await screen.findByLabelText("访问原因")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "群聊" }));
  await screen.findByText("学习群");
  expect(screen.queryByLabelText("访问原因")).not.toBeInTheDocument();
  expect(queryImMessages).not.toHaveBeenCalled();
});

it("opens the group tab when returning from group details", async () => {
  show("/im?type=GROUP");
  await screen.findByText("学习群");
  expect(screen.getByRole("tab", { name: "群聊" })).toHaveAttribute("aria-selected", "true");
  expect(listImConversations).toHaveBeenCalledWith("", "GROUP", 1);
});

it("resets pagination when switching conversation types", async () => {
  vi.mocked(listImConversations).mockResolvedValue({ items: [direct], total: 40, sourceNote: "" });
  show();
  await screen.findByText("小明 与 小红");
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() => expect(listImConversations).toHaveBeenCalledWith("", "DIRECT", 2));
  fireEvent.click(screen.getByRole("tab", { name: "群聊" }));
  await waitFor(() => expect(listImConversations).toHaveBeenCalledWith("", "GROUP", 1));
});

it("shows query failures with diagnostic context and allows an explicit retry", async () => {
  vi.mocked(queryImMessages)
    .mockRejectedValueOnce(new ApiError("Forbidden", 403, undefined, "history-request"))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  show();
  fireEvent.click(within(await screen.findByRole("row", { name: /小明 与 小红/ })).getByRole("button", { name: "查看聊天记录" }));
  fireEvent.change(await screen.findByLabelText("访问原因"), { target: { value: "排查查询失败" } });
  fireEvent.click(screen.getByRole("button", { name: "审计并查询" }));
  expect(await screen.findByText("请求状态：HTTP 403")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
  await waitFor(() => expect(queryImMessages).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("无符合条件的可用消息")).toBeVisible();
});

it("links the private title to its standalone details page", async () => {
  show();
  const row = await screen.findByRole("row", { name: /小明 与 小红/ });
  expect(screen.queryByText(direct.id)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("群成员人数")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "会话详情" })).not.toBeInTheDocument();
  expect(within(row).queryByText("内部编号（排查使用）")).not.toBeInTheDocument();
  expect(within(row).getByRole("link", { name: "小明 与 小红" })).toHaveAttribute("href", `/im/conversations/${direct.id}`);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(queryImMessages).not.toHaveBeenCalled();
});

it("links the group title to details and opens history only from its dedicated action", async () => {
  permissions.community = true;
  show("/im?type=GROUP");
  const row = await screen.findByRole("row", { name: /学习群/ });
  expect(within(row).getByRole("link", { name: "查看学习群的群成员，共10人" })).toHaveAttribute("href", "/community/groups/group-123456789?tab=members");
  expect(within(row).getByText("10 人")).toBeVisible();
  expect(within(row).queryByText("小明")).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "群成员" })).toBeInTheDocument();
  expect(within(row).queryByRole("link", { name: "群聊详情" })).not.toBeInTheDocument();
  expect(screen.queryByText("group-123456789")).not.toBeInTheDocument();
  expect(within(row).queryByText("内部编号（排查使用）")).not.toBeInTheDocument();
  expect(within(row).getByRole("link", { name: /^学习群$/ })).toHaveAttribute("href", "/community/groups/group-123456789");
  expect(screen.queryByRole("dialog", { name: "聊天记录" })).not.toBeInTheDocument();
  fireEvent.click(within(row).getByRole("button", { name: "查看聊天记录" }));
  const panel = await screen.findByRole("dialog", { name: "聊天记录" });
  expect(within(panel).getByText("聊天记录 · 学习群")).toBeVisible();
  expect(queryImMessages).not.toHaveBeenCalled();
});

it("merges and paginates retained records without skipping either timeline", async () => {
  permissions.archive = true;
  vi.mocked(queryImMessages).mockImplementation(async (_id, filters, archive) => {
    const heights = archive ? Array.from({ length: 30 }, (_, i) => 60 - i * 2) : Array.from({ length: 30 }, (_, i) => 59 - i * 2);
    const available = heights.filter((height) => !filters.cursor || height < filters.cursor);
    return {
      items: available.map((height) => ({ id: `message-${height}`, height, senderId: null, type: "text", createdAt: "2026-10-18T00:00:00Z", visibleUntil: null, mediaExpiresAt: null, content: { text: `记录第${height}条` } })),
      nextCursor: null,
    };
  });
  show();
  fireEvent.click(within(await screen.findByRole("row", { name: /小明 与 小红/ })).getByRole("button", { name: "查看聊天记录" }));
  fireEvent.change(screen.getByLabelText("访问原因"), { target: { value: "核查留存" } });
  fireEvent.click(screen.getByRole("button", { name: "审计并查询" }));
  expect(await screen.findByText("记录第60条")).toBeVisible();
  expect(screen.getByText("记录第31条")).toBeVisible();
  expect(screen.queryByText("记录第30条")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "加载更早消息（再次审计）" }));
  expect(await screen.findByText("记录第1条")).toBeVisible();
  expect(screen.getByText("记录第30条")).toBeVisible();
  expect(queryImMessages).toHaveBeenCalledWith(direct.id, { reason: "核查留存", cursor: 31 }, false);
  expect(queryImMessages).toHaveBeenCalledWith(direct.id, { reason: "核查留存", cursor: 31 }, true);
  expect(screen.getByRole("button", { name: "加载更早消息（再次审计）" })).toBeDisabled();
});
