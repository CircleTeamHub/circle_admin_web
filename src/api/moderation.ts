import { apiClient } from "./client";
import { listFriendReports, reviewFriendReport } from "./reports";
import type {
  AdminUser,
  FriendReport,
  PageResult,
  ReportStatus,
  ReviewDecision,
} from "../types";

export type ReportKind = "friend" | "group" | "post";
export interface ModerationReport extends FriendReport {
  groupID?: string;
  postID?: string;
  reporterID?: string;
  reviewedByID?: string;
  reason?: string | null;
  circle?: { id: string; name: string } | null;
}
export interface ContentPost {
  id: string;
  content: string;
  images: string[];
  tags: string[];
  status: "ACTIVE" | "ENDED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  author: AdminUser;
  circle: { id: string; name: string };
  reportCount: number;
}
export function listReports(
  kind: ReportKind,
  params: { status: ReportStatus; page: number; limit: number },
): Promise<PageResult<ModerationReport>> {
  if (kind === "friend") return listFriendReports(params);
  return apiClient(
    `/admin/moderation/${kind}-reports?${new URLSearchParams({ status: params.status, page: String(params.page), limit: String(params.limit) })}`,
  );
}
export function reviewReport(
  kind: ReportKind,
  id: string,
  decision: ReviewDecision,
  note?: string,
) {
  if (kind === "friend") return reviewFriendReport(id, decision, note);
  return apiClient(`/admin/moderation/${kind}-reports/${id}/review`, {
    method: "POST",
    retryOnUnauthorized: false,
    body: JSON.stringify({ approve: decision === "APPROVE", note }),
  });
}
export function listPosts(
  page: number,
  search: string,
  status?: string,
): Promise<PageResult<ContentPost>> {
  return apiClient(
    `/admin/content/posts?${new URLSearchParams({ page: String(page), limit: "20", search, ...(status ? { status } : {}) })}`,
  );
}
export function getPost(id: string): Promise<ContentPost> {
  return apiClient(`/admin/content/posts/${id}`);
}
export function moderatePost(
  id: string,
  action: "takedown" | "restore",
  note?: string,
) {
  return apiClient(`/admin/moderation/posts/${id}/${action}`, {
    method: "POST",
    retryOnUnauthorized: false,
    body: JSON.stringify(action === "takedown" ? { note } : {}),
  });
}
export function listWords(
  page = 1,
  search = "",
): Promise<{
  total: number;
  words: { id: string; word: string; createdAt: string }[];
}> {
  return apiClient(
    `/admin/content/sensitive-words?${new URLSearchParams({ page: String(page), limit: "20", search })}`,
  );
}
export function mutateWords(
  action: "add" | "remove",
  words: string[],
): Promise<{ added?: number; removed?: number; requested?: number }> {
  return apiClient(`/admin/sensitive-words/${action}`, {
    method: "POST",
    retryOnUnauthorized: false,
    body: JSON.stringify({ words }),
  });
}
export function publishAnnouncement(
  content: string,
  key: string,
): Promise<{ createdCount: number }> {
  return apiClient("/admin/system-announcements", {
    method: "POST",
    retryOnUnauthorized: false,
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ content }),
  });
}
