import { apiClient } from "./client";

export interface AvatarFrameAsset {
  id: string;
  key: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  minimumVipLevel: number | null;
  sortOrder: number;
}

export type AvatarFrameOwnedSource =
  | {
      type: "MEMBERSHIP";
      minimumVipLevel: number;
      expiresAt: string | null;
    }
  | {
      type: "ADMIN";
      grantId: string;
      expiresAt: string | null;
    };

export interface AvatarFrameInventoryItem
  extends Omit<AvatarFrameAsset, "sortOrder"> {
  ownedSources: AvatarFrameOwnedSource[];
  availableUntil: string | null;
  equipped: boolean;
}

export interface AvatarFrameGrant {
  id: string;
  userId: string;
  frameId: string;
  frame?: Pick<AvatarFrameAsset, "id" | "key" | "name" | "imageUrl">;
  operatorUserId: string;
  idempotencyKey: string;
  reason: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

export interface UserAvatarFrameInventory {
  userId: string;
  equippedFrameId: string | null;
  equippedFrameExpiresAt: string | null;
  equippedFrame: AvatarFrameInventoryItem | null;
  items: AvatarFrameInventoryItem[];
  grants: {
    items: AvatarFrameGrant[];
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface GrantAvatarFramePayload {
  frameId: string;
  expiresAt: string | null;
  reason: string;
  idempotencyKey: string;
}

export function listAvatarFrameAssets(): Promise<AvatarFrameAsset[]> {
  return apiClient<AvatarFrameAsset[]>("/admin/avatar-frames/assets");
}

export function getUserAvatarFrames(
  userId: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<UserAvatarFrameInventory> {
  const search = new URLSearchParams();
  if (options.cursor) search.set("cursor", options.cursor);
  search.set("limit", String(options.limit ?? 50));
  return apiClient<UserAvatarFrameInventory>(
    `/admin/avatar-frames/users/${encodeURIComponent(userId)}?${search}`,
  );
}

export function grantAvatarFrame(
  userId: string,
  payload: GrantAvatarFramePayload,
): Promise<{ replayed: boolean; grant: AvatarFrameGrant }> {
  return apiClient(`/admin/avatar-frames/users/${encodeURIComponent(userId)}/grants`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeAvatarFrameGrant(
  grantId: string,
  payload: { reason: string },
): Promise<{ replayed: boolean; grant: AvatarFrameGrant }> {
  return apiClient(
    `/admin/avatar-frames/grants/${encodeURIComponent(grantId)}/revoke`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
