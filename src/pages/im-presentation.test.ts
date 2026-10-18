import { expect, it } from "vitest";
import {
  conversationTitle,
  conversationTypeLabel,
} from "./im-presentation";
import type { ImConversation } from "../api/admin-im";
const row = {
  id: "id",
  type: "DIRECT",
  name: null,
  circleID: null,
  memberCount: 2,
  participants: [
    { id: "a", nickname: "小明" },
    { id: "b", nickname: "小红" },
  ],
  lastMessageAt: null,
} satisfies ImConversation;
it("uses participant names for direct chats and sensible unnamed fallbacks", () => {
  expect(conversationTitle(row)).toBe("小明 与 小红");
  expect(conversationTitle({ ...row, participants: [] })).toBe("未命名单聊");
  expect(conversationTitle({ ...row, type: "GROUP", name: "  " })).toBe(
    "未命名群聊",
  );
  expect(
    conversationTitle({
      ...row,
      type: "GROUP",
      circle: { id: "circle", name: "学习圈" },
    }),
  ).toBe("学习圈");
});
it("uses Chinese types and short copyable labels", () => {
  expect(conversationTypeLabel("DIRECT")).toBe("单聊");
  expect(conversationTypeLabel("GROUP")).toBe("群聊");
  expect(conversationTypeLabel("future")).toBe("其他会话");
});
