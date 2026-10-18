import { apiClient } from "./client";
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface Plan {
  level: number;
  key: string;
  priceCny: number;
  lifetime: boolean;
}
export interface Member {
  id: string;
  accountId: string;
  nickname: string;
  vipLevel: number;
  vipExpiresAt: string | null;
  membershipGrantsReceived: {
    id: string;
    operatorUserID: string;
    previousLevel: number;
    newLevel: number;
    planId?: string | null;
    quantity?: number;
    newExpiresAt: string | null;
    note: string | null;
    createdAt: string;
  }[];
}
export function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") q.set(k, String(v));
  });
  return `?${q}`;
}
export const listMembers = (
  params: Record<string, string | number | undefined>,
) => apiClient<Page<Member>>("/admin/commerce/memberships" + query(params));
export const listPlans = () => apiClient<Plan[]>("/membership/plans");
export const listMembershipGrants = (id: string, cursor?: string) =>
  apiClient<Page<Member["membershipGrantsReceived"][number]>>(
    `/admin/commerce/memberships/${encodeURIComponent(id)}/grants` +
      query({ cursor }),
  );
export const grantMembership = (
  id: string,
  body: {
    targetLevel: number;
    planId?: "daily";
    quantity?: number;
    idempotencyKey: string;
    note?: string;
  },
) =>
  write(
    `/admin/memberships/users/${encodeURIComponent(id)}/grants`,
    "POST",
    body,
  );
function write(path: string, method: string, body: unknown) {
  return apiClient<unknown>(path, {
    method,
    body: JSON.stringify(body),
    retryOnUnauthorized: false,
  });
}
