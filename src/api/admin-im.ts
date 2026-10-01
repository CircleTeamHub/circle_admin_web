import { apiClient } from "./client";
export interface ImConversation {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  circleID: string | null;
  memberCount: number;
  participants: { id: string; nickname: string }[];
  lastMessageAt: string | null;
}
export interface ImMessage {
  id: string;
  height: number;
  senderId: string | null;
  type: string;
  createdAt: string;
  visibleUntil: string | null;
  mediaExpiresAt: string | null;
  content: Record<string, unknown>;
}
export interface ImFilters {
  reason: string;
  senderId?: string;
  from?: string;
  to?: string;
  text?: string;
  cursor?: number;
}
export interface ImMember {
  id: string;
  nickname: string;
  role: string;
  silenced: boolean;
  silencedUntil: string | null;
  joinedAt: string;
}
export interface MemberList {
  items: ImMember[];
  total: number;
  name: string | null;
  circle: { id: string; name: string } | null;
}
export type MemberAction = "mute" | "unmute" | "remove" | "role";
export const listImConversations = (
  keyword: string,
  type: string | undefined,
  page: number,
) =>
  apiClient<{ items: ImConversation[]; total: number; sourceNote: string }>(
    `/admin/im/conversations?${new URLSearchParams({ keyword, page: String(page), limit: "20", ...(type ? { type } : {}) })}`,
  );
export const queryImMessages = (id: string, filters: ImFilters) =>
  apiClient<{ items: ImMessage[]; nextCursor: number | null }>(
    `/admin/im/conversations/${encodeURIComponent(id)}/messages/query`,
    {
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({ ...filters, limit: 30 }),
    },
  );
export const listImMembers = (id: string, keyword: string, page: number) =>
  apiClient<MemberList>(
    `/admin/im/conversations/${encodeURIComponent(id)}/members?${new URLSearchParams({ keyword, page: String(page), limit: "30" })}`,
  );
export const moderateImMember = (
  id: string,
  target: string,
  action: MemberAction,
  reason: string,
  role?: "ADMIN" | "MEMBER",
) =>
  apiClient<{ completed?: boolean; handled?: boolean }>(
    `/admin/im/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(target)}/actions`,
    {
      method: "POST",
      retryOnUnauthorized: false,
      body: JSON.stringify({ action, reason, role, confirmed: true }),
    },
  );
