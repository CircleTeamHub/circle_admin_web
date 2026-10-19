import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ImPage } from "./ImPage";
import { listImConversations, queryImMessages } from "../api/admin-im";
vi.mock("../api/admin-im", () => ({
  listImConversations: vi.fn(),
  queryImMessages: vi.fn(),
}));
vi.mock("../auth/admin-access", () => ({
  useAdminAccess: () => ({
    hasPermission: (permission: string) => permission === "USER_READ",
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
  vi.mocked(listImConversations).mockResolvedValue({
    items: [
      direct,
      {
        ...direct,
        id: "group-123456789",
        type: "GROUP",
        name: "学习群",
        circleID: "circle-123456789",
        circle: { id: "circle-123456789", name: "学习圈" },
        memberCount: 10,
      },
    ],
    total: 2,
    sourceNote: "",
  });
});
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ImPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("explains conversation types, people, circles and missing message time", async () => {
  show();
  await screen.findByText("小明 与 小红");
  expect(screen.getByText("单聊")).toBeTruthy();
  expect(screen.getByText("群聊")).toBeTruthy();
  expect(screen.getByText("学习圈")).toBeTruthy();
  expect(screen.getByText("共 10 人，仅显示前 2 人")).toBeTruthy();
  expect(screen.getAllByText("未记录消息时间")).toHaveLength(2);
  expect(
    screen.getAllByRole("link", { name: "小明" })[0].getAttribute("href"),
  ).toBe("/users/a");
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
  expect(await screen.findByText("聊天记录 · 小明 与 小红")).toBeTruthy();
  expect(screen.getByLabelText("访问原因")).toBeTruthy();
  expect(queryImMessages).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "关闭记录" }));
  expect(screen.queryByLabelText("访问原因")).toBeNull();
  expect(queryImMessages).not.toHaveBeenCalled();
});
