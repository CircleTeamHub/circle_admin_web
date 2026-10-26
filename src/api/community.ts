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
  "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface AdminGroupOperationSummary {
  id: string;
  groupID?: string;
  type: AdminGroupOperationType;
  status: AdminGroupOperationStatus;
  lastError: string | null;
  createdAt?: string;
}

export interface AdminCircle {
  associatedGroup?: {
    id: string;
    circleID: string | null;
    name: string | null;
  } | null;
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
  conversationId?: string;
  managementSupported?: boolean;
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
  return apiClient(
    `/admin/community/circles/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason, confirmation }),
    },
  );
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

export interface CirclePerson {
  id: string;
  accountId: string;
  nickname: string;
  avatarUrl: string | null;
}
export interface CircleGroupDetail {
  id: string;
  name: string | null;
  muteAllAt: string | null;
  qrJoinEnabled: boolean;
  cardJoinEnabled: boolean;
  joinApprovalRequired: boolean;
  membersCanViewProfiles: boolean;
  membersCanViewRoster: boolean;
  membersCanAddFriends: boolean;
}
export interface AdminCircleDetail extends Omit<
  AdminCircle,
  "associatedGroup" | "latestOperation" | "groupID"
> {
  description: string;
  avatarUrl: string | null;
  cover: string | null;
  currentIconUrl: string | null;
  cities: string[];
  categories: string[];
  tags: string[];
  rules: string;
  isPublic: boolean;
  joinVipRestriction: number | null;
  joinCreditRestriction: number | null;
  joinFancyRestriction: boolean;
  maxMembers: number | null;
  expansionSeats: number;
  memberCanPost: boolean;
  memberCanInvite: boolean;
  requiredVerifierCount: number;
  updatedAt: string;
  associatedGroup: CircleGroupDetail | null;
  owner: CirclePerson;
}
export interface AdminCircleMember {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  user: CirclePerson;
}
export interface AdminCirclePost {
  id: string;
  content: string;
  images: string[];
  tags: string[];
  city: string | null;
  cities: string[];
  isHorn: boolean;
  noteID: string | null;
  status: string;
  viewCount: number;
  signupCount: number;
  vipRestriction: number | null;
  creditRestriction: number | null;
  fancyRestriction: boolean;
  signupVipRestriction: number | null;
  signupCreditRestriction: number | null;
  signupFancyRestriction: boolean;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  expiresAt: string | null;
  author: CirclePerson;
  circle: { id: string; name: string };
  circleLinks: { circle: { id: string; name: string } }[];
}
export function getAdminCircle(id: string): Promise<AdminCircleDetail> {
  return apiClient(`/admin/community/circles/${encodeURIComponent(id)}`);
}
export function getAdminCircleMembers(
  id: string,
  page: number,
): Promise<PaginatedResult<AdminCircleMember>> {
  return apiClient(
    `/admin/community/circles/${encodeURIComponent(id)}/members?page=${page}&limit=20`,
  );
}
export function getAdminCirclePosts(
  id: string,
  page: number,
): Promise<PaginatedResult<AdminCirclePost>> {
  return apiClient(
    `/admin/community/circles/${encodeURIComponent(id)}/posts?page=${page}&limit=20`,
  );
}

export interface AdminGroupDetail extends CircleGroupDetail {
  type: "GROUP";
  circleID: string | null;
  avatarUrl: string | null;
  notice: string | null;
  ownerID: string | null;
  owner: CirclePerson | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  memberCanInvite: boolean;
  circle: {
    id: string;
    name: string;
    deleted: boolean;
    adminState: CircleAdminState;
  } | null;
}
export interface AdminGroupMember {
  id: string;
  userID: string;
  role: string;
  alias: string | null;
  joinedAt: string;
  leftAt: string | null;
  silencedAt: string | null;
  silencedUntil: string | null;
  user: CirclePerson | null;
}
export interface AdminGroupEvent {
  id: string;
  kind: string;
  actor: CirclePerson | null;
  targets: CirclePerson[];
  payload: Record<string, unknown> | null;
  createdAt: string;
}
export function getAdminGroup(id: string): Promise<AdminGroupDetail> {
  return apiClient(`/admin/community/groups/${encodeURIComponent(id)}`);
}
export function getAdminGroupMembers(
  id: string,
  page: number,
): Promise<PaginatedResult<AdminGroupMember>> {
  return apiClient(
    `/admin/community/groups/${encodeURIComponent(id)}/members?page=${page}&limit=20`,
  );
}
export function getAdminGroupEvents(
  id: string,
  page: number,
): Promise<PaginatedResult<AdminGroupEvent>> {
  return apiClient(
    `/admin/community/groups/${encodeURIComponent(id)}/events?page=${page}&limit=20`,
  );
}
