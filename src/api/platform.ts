import { apiClient } from "./client";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Person {
  id: string;
  accountId: string;
  nickname: string;
  status?: string;
}
export interface AuditLog {
  id: string;
  actorID: string;
  actorAccountId: string | null;
  operator: Person | null;
  action: string;
  entityType: string;
  entityID: string | null;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}
export interface PersonalInvite extends Person {
  inviteCode: string | null;
  _count: { referralsSent: number };
}
export interface Campaign {
  id: string;
  code: string;
  name: string;
  owner: Person;
  enabled: boolean;
  usedCount: number;
  maxUses: number;
  expiresAt: string;
  version: number;
}
export interface Referral {
  id: string;
  status: string;
  inviter: Person;
  invitee: Person;
  inviterReward: number;
  inviteeReward: number;
  eligibleAt: string | null;
  rewardedAt: string | null;
  createdAt: string;
  failureReason: string | null;
}
export interface CampaignCreate {
  name: string;
  ownerAccountId: string;
  count: number;
  maxUses: number;
  expiresAt: string;
  reason: string;
}
export interface CampaignUpdate {
  version: number;
  enabled: boolean;
  maxUses: number;
  expiresAt: string;
  reason: string;
}
export interface AdvertisementInput {
  title: string;
  imageUrl: string;
  targetUrl: string;
  placement: "CIRCLE_HOME";
  sortOrder: number;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  reason: string;
}
export interface Advertisement extends Omit<AdvertisementInput, "reason"> {
  id: string;
  version: number;
}
export type ConsoleRole =
  | "SUPER_ADMIN"
  | "OPERATIONS"
  | "MODERATOR"
  | "SUPPORT";
export interface AdminAccount extends Person {
  consoleRole: ConsoleRole | null;
  version: number;
}
export interface Access {
  role: ConsoleRole;
  permissions: string[];
  version: number;
}
export type ListQuery = Record<string, string | number | undefined>;
export function platformList<T>(
  path: string,
  query: ListQuery,
): Promise<Page<T>> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return apiClient<Page<T>>(`${path}?${params}`);
}
export function platformWrite<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  key?: string,
): Promise<T> {
  return apiClient<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: key ? { "Idempotency-Key": key } : undefined,
  });
}
export function getPlatformAccess() {
  return apiClient<Access>("/admin/access/me");
}
export function personLabel(person: Person) {
  return `${person.accountId}${person.nickname ? ` (${person.nickname})` : ""}`;
}
export function publicHttps(value: string): boolean {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) &&
      !/^[\d.]+$/.test(host) &&
      !/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example)$/.test(
        host,
      )
    );
  } catch {
    return false;
  }
}
