import { apiClient } from "./client";

export type CircleAdminState =
  | "ACTIVE"
  | "DISABLING"
  | "DISABLED"
  | "RESTORING"
  | "SYNC_FAILED"
  | "DISMISSED";
export type AdminGroupOperationType = "MUTE" | "UNMUTE" | "DISMISS";
export type AdminGroupOperationStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED";

export interface AdminGroupOperationSummary {
  id: string;
  groupID?: string;
  type: AdminGroupOperationType;
  status: AdminGroupOperationStatus;
  lastError: string | null;
  createdAt?: string;
}

export interface AdminCircle {
  id: string;
  name: string;
  groupID: string | null;
  memberCount: number;
  postCount: number;
  deleted: boolean;
  adminState: CircleAdminState;
  adminDisabledAt: string | null;
  adminDisabledBy: string | null;
  adminDisableReason: string | null;
  createdAt: string;
  owner: { id: string; accountId: string; nickname: string };
  latestOperation: AdminGroupOperationSummary | null;
}

export interface AdminOpenimGroup {
  groupId: string;
  name: string;
  faceUrl: string | null;
  status: number;
  muted: boolean;
  memberCount: number;
  ownerUserId: string | null;
  ownerName: string | null;
  linkedCircle: { id: string; name: string } | null;
  pendingOperation: AdminGroupOperationSummary | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export function listAdminCircles(query: {
  page: number;
  limit: number;
  search?: string;
  status?: CircleAdminState;
}): Promise<PaginatedResult<AdminCircle>> {
  return apiClient<PaginatedResult<AdminCircle>>(
    `/admin/community/circles?${queryString(query)}`,
  );
}

export function listAdminGroups(query: {
  page: number;
  limit: number;
  search?: string;
}): Promise<PaginatedResult<AdminOpenimGroup>> {
  return apiClient<PaginatedResult<AdminOpenimGroup>>(
    `/admin/community/groups?${queryString(query)}`,
  );
}

function circleAction(
  id: string,
  action: "disable" | "restore",
  reason: string,
  confirmation: string,
  idempotencyKey: string,
) {
  return apiClient(`/admin/community/circles/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ reason, confirmation }),
  });
}

export function disableCircle(
  id: string,
  reason: string,
  confirmation: string,
  idempotencyKey: string,
) {
  return circleAction(id, "disable", reason, confirmation, idempotencyKey);
}

export function restoreCircle(
  id: string,
  reason: string,
  confirmation: string,
  idempotencyKey: string,
) {
  return circleAction(id, "restore", reason, confirmation, idempotencyKey);
}

export function requestGroupOperation(
  groupId: string,
  type: AdminGroupOperationType,
  reason: string,
  confirmation: string,
  idempotencyKey: string,
) {
  return apiClient(
    `/admin/community/groups/${encodeURIComponent(groupId)}/operations`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ type, reason, confirmation }),
    },
  );
}
