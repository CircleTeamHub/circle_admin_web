import { apiClient } from "./client";
import type { AdminUser, PageResult, UserStatus } from "../types";

export interface UserListParams {
  page?: number;
  limit?: number;
  accountId?: string;
  status?: UserStatus;
}

export function listUsers(query: string): Promise<PageResult<AdminUser>> {
  return apiClient<PageResult<AdminUser>>(`/user?${query}`);
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
