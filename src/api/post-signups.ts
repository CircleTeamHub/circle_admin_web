import { apiClient } from "./client";
export interface PostSignup {
  id: string;
  createdAt: string;
  seenByAuthor: boolean;
  seenAt: string | null;
  user: {
    id: string;
    nickname: string;
    accountId: string;
    avatarUrl: string | null;
    status: string;
  };
}
export function getPostSignups(
  postID: string,
  page: number,
): Promise<{
  items: PostSignup[];
  total: number;
  page: number;
  limit: number;
}> {
  return apiClient(
    `/admin/content/posts/${encodeURIComponent(postID)}/signups?page=${page}&limit=20`,
    { cache: "no-store" },
  );
}
