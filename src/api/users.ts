import { apiClient } from "./client";
import type { AdminUser, PageResult, UserStatus } from "../types";

export interface UserListParams {
  page?: number;
  limit?: number;
  accountId?: string;
  status?: UserStatus;
}

type BackendUserListResponse = {
  items?: AdminUser[];
  data?: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
};

export function normalizeUserListResponse(
  response: BackendUserListResponse,
): PageResult<AdminUser> {
  return {
    items: response.items ?? response.data ?? [],
    total: response.total ?? 0,
    page: response.page ?? 1,
    limit: response.limit ?? 20,
  };
}

export async function listUsers(query: string): Promise<PageResult<AdminUser>> {
  const response = await apiClient<BackendUserListResponse>(`/user?${query}`);
  return normalizeUserListResponse(response);
}

export function updateUserStatus(
  id: string,
  status: UserStatus,
  reason?: string,
): Promise<AdminUser> {
  return apiClient<AdminUser>(`/user/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}
