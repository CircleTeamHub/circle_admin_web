import type { ImConversation } from "../api/admin-im";
export function conversationTitle(conversation: ImConversation) {
  if (conversation.type === "DIRECT") {
    const names = conversation.participants
      .slice(0, 2)
      .map((p) => p.nickname.trim())
      .filter(Boolean);
    return names.length ? names.join(" 与 ") : "未命名单聊";
  }
  return (
    conversation.name?.trim() ||
    conversation.circle?.name.trim() ||
    "未命名群聊"
  );
}
export function conversationTypeLabel(type: string) {
  return type === "DIRECT" ? "单聊" : type === "GROUP" ? "群聊" : "其他会话";
}
