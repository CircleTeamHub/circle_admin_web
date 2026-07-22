import { apiClient } from "./client";
import type {
  AdminAuditLog,
  AdminUpdateUserStatusPayload,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserStatusSummary,
  PageResult,
  SensitiveAccessResponse,
  SensitiveField,
  UserRole,
  UserStatus,
} from "../types";

export interface UserListParams {
  keyword?: string;
  status?: UserStatus;
  role?: UserRole;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}

type BackendUserListResponse = {
  items?: AdminUserListItem[];
  data?: AdminUserListItem[];
  total?: number;
  page?: number;
  limit?: number;
};

export function userListQueryString(params: UserListParams): string {
  const search = new URLSearchParams();
  const keyword = params.keyword?.trim();
  if (keyword) search.set("keyword", keyword);
  if (params.status) search.set("status", params.status);
  if (params.role) search.set("role", params.role);
  if (params.createdFrom) search.set("createdFrom", params.createdFrom);
  if (params.createdTo) search.set("createdTo", params.createdTo);
  search.set("page", String(params.page ?? 1));
  search.set("limit", String(params.limit ?? 20));
  return search.toString();
}

export function normalizeUserListResponse(
  response: BackendUserListResponse,
): PageResult<AdminUserListItem> {
  return {
    items: response.items ?? response.data ?? [],
    total: response.total ?? 0,
    page: response.page ?? 1,
    limit: response.limit ?? 20,
  };
}

export async function listUsers(
  params: UserListParams | string,
): Promise<PageResult<AdminUserListItem>> {
  const query =
    typeof params === "string" ? params : userListQueryString(params);
  const response = await apiClient<BackendUserListResponse>(
    `/admin/users?${query}`,
  );
  return normalizeUserListResponse(response);
}

export function getUserDetail(id: string): Promise<AdminUserDetail> {
  return apiClient<AdminUserDetail>(`/admin/users/${id}`);
}

export function revealSensitiveField(
  id: string,
  payload: { field: SensitiveField; reason: string },
): Promise<SensitiveAccessResponse> {
  return apiClient<SensitiveAccessResponse>(
    `/admin/users/${id}/sensitive-access`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateUserStatus(
  id: string,
  payload: AdminUpdateUserStatusPayload,
): Promise<AdminUserStatusSummary>;
export function updateUserStatus(
  id: string,
  status: UserStatus,
  reason?: string,
): Promise<AdminUserStatusSummary>;
export function updateUserStatus(
  id: string,
  payloadOrStatus: AdminUpdateUserStatusPayload | UserStatus,
  reason?: string,
): Promise<AdminUserStatusSummary> {
  const payload =
    typeof payloadOrStatus === "string"
      ? { status: payloadOrStatus, reason }
      : payloadOrStatus;
  return apiClient<AdminUserStatusSummary>(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listUserAuditLogs(
  id: string,
  limit = 20,
): Promise<AdminAuditLog[]> {
  return apiClient<AdminAuditLog[]>(
    `/admin/users/${id}/audit-logs?limit=${limit}`,
  );
}
