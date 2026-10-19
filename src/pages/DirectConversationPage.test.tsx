import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { listImConversations, queryImMessages } from "../api/admin-im";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { DirectConversationPage } from "./DirectConversationPage";
vi.mock("../api/admin-im", () => ({ listImConversations: vi.fn(), queryImMessages: vi.fn() }));
vi.mock("./ImPage", () => ({ ConversationHistory: () => <div>审计查询面板</div> }));
const conversation = { id: "direct-id", type: "DIRECT" as const, name: null, circleID: null, memberCount: 2, participants: [{ id: "a", nickname: "小明" }, { id: "b", nickname: "小红" }], lastMessageAt: null };
function show(permissions: AdminPermission[] = ["IM_READ", "USER_READ"]) {
  render(<AdminAccessContext.Provider value={{ role: "OPERATIONS", permissions, version: 1 }}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/im/conversations/direct-id"]}><Routes><Route path="/im/conversations/:conversationId" element={<DirectConversationPage />} /></Routes></MemoryRouter></QueryClientProvider></AdminAccessContext.Provider>);
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listImConversations).mockResolvedValue({ items: [conversation], total: 1, sourceNote: "" }); });
it("loads direct details on a fresh URL and keeps history behind its tab", async () => {
  show();
  expect(await screen.findByRole("heading", { name: "小明 与 小红" })).toBeVisible();
  expect(listImConversations).toHaveBeenCalledWith("direct-id", "DIRECT", 1);
  expect(screen.getByRole("link", { name: "返回私聊列表" })).toHaveAttribute("href", "/im?type=DIRECT");
  expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute("href", "/users/a");
  expect(screen.queryByText("direct-id")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("审计查询面板")).not.toBeInTheDocument();
  expect(queryImMessages).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "聊天记录" }));
  expect(await screen.findByText("审计查询面板")).toBeVisible();
});
it("does not substitute another conversation for a missing ID", async () => {
  vi.mocked(listImConversations).mockResolvedValue({ items: [{ ...conversation, id: "another-id" }], total: 1, sourceNote: "" });
  show();
  expect(await screen.findByText("私聊会话不存在或已不可用")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "小明 与 小红" })).not.toBeInTheDocument();
});
it("keeps profile navigation within the administrator's permissions", async () => {
  show(["IM_READ"]);
  await screen.findByRole("heading", { name: "小明 与 小红" });
  expect(screen.queryByRole("link", { name: "小明" })).not.toBeInTheDocument();
});
