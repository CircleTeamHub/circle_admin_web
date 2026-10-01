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
    newExpiresAt: string | null;
    note: string | null;
    createdAt: string;
  }[];
}
export interface Inventory {
  id: string;
  value: string;
  status: string;
  source: string;
}
export interface NumberOwnership {
  id: string;
  value: string;
  status: string;
  leases: {
    user: { accountId: string };
    expiresAt: string | null;
    permanentAt: string | null;
  }[];
}
export const listNumberOwnership = (
  params: Record<string, string | number | undefined>,
) =>
  apiClient<Page<NumberOwnership>>(
    "/admin/commerce/fancy-number-ownership" + query(params),
  );
export interface NumberOrder {
  id: string;
  type: string;
  totalPrice: number;
  newExpiresAt: string | null;
  createdAt: string;
  user: { accountId: string; nickname: string };
  fancyNumber: {
    value: string;
    status: string;
    leases: {
      user: { accountId: string };
      expiresAt: string | null;
      permanentAt: string | null;
    }[];
  };
  lease: {
    endedAt: string | null;
    expiresAt: string | null;
    permanentAt: string | null;
  };
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
  body: { targetLevel: number; idempotencyKey: string; note?: string },
) =>
  write(
    `/admin/memberships/users/${encodeURIComponent(id)}/grants`,
    "POST",
    body,
  );
export const listInventory = (
  params: Record<string, string | number | undefined>,
) => apiClient<Page<Inventory>>("/admin/mall/fancy-numbers" + query(params));
export const listNumberOrders = (
  params: Record<string, string | number | undefined>,
) =>
  apiClient<Page<NumberOrder>>(
    "/admin/commerce/fancy-number-orders" + query(params),
  );
export const batchNumbers = (values: string[]) =>
  write("/admin/mall/fancy-numbers/batch", "POST", { values });
export const toggleNumber = (id: string, enabled: boolean) =>
  write(`/admin/mall/fancy-numbers/${encodeURIComponent(id)}/status`, "PATCH", {
    enabled,
  });
function write(path: string, method: string, body: unknown) {
  return apiClient<unknown>(path, {
    method,
    body: JSON.stringify(body),
    retryOnUnauthorized: false,
  });
}
