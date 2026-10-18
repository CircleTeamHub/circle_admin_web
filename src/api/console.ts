import { apiClient } from "../api/client";

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface Task {
  id: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  retryable?: boolean;
  notification?: {
    type: string;
    toUserID: string | null;
    toUser?: { id: string; nickname: string } | null;
  } | null;
  deliveryCounts?: Record<string, number>;
  completionReason?: string | null;
}
export interface Push extends Task {
  notification: {
    toUserID: string | null;
    type: string;
    toUser?: { id: string; nickname: string } | null;
  };
  deliveries: Array<{
    deviceID: string | null;
    provider: string | null;
    platform: string | null;
    id: string;
    status: string;
    attempts: number;
    lastError: string | null;
    sentAt: string | null;
    receiptCheckedAt: string | null;
  }>;
}
export interface ConsolePerson {
  id: string;
  nickname: string;
  accountId: string;
}
export interface Event {
  user?: ConsolePerson | null;
  id: string;
  userID: string;
  name: string;
  source: string;
  entityType: string | null;
  entityID: string | null;
  platform: string | null;
  appVersion: string | null;
  createdAt: string;
}
export interface Release {
  id: string;
  platform: string;
  channel: string;
  version: string;
  build: number;
  url: string;
  sha256: string;
  sizeBytes: number;
  notes: string;
  withdrawnAt: string | null;
  createdAt: string;
}
export interface Plan {
  id: string;
  releaseID: string;
  rollout: number;
  minBuild: number;
  maxBuild: number;
  forceBelow: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  version: number;
  release: Release;
}
export interface Key {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}
export interface Audit {
  requestRoute?: string | null;
  requestMethod?: string | null;
  failureCause?: string | null;
  actor?: ConsolePerson | null;
  actorAccountId?: string | null;
  failureStatus?: number | null;
  id: string;
  actorID: string;
  action: string;
  entityType: string | null;
  entityID: string | null;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}
export const consoleApi = {
  tasks: (q: URLSearchParams) =>
    apiClient<Page<Task> & { kind: string }>(`/admin/console/tasks?${q}`),
  overview: () =>
    apiClient<{
      generatedAt: string;
      items: Array<{
        kind: string;
        pending: number;
        dead: number | null;
        oldestAt: string | null;
      }>;
      groupOperations: Array<{ status: string; _count: number }>;
    }>("/admin/console/tasks/overview"),
  pushes: (q: URLSearchParams) =>
    apiClient<Page<Push>>(`/admin/console/push?${q}`),
  pushOverview: () =>
    apiClient<{
      settings: { enabled: boolean; version: number };
      counts: Array<{ status: string; _count: number }>;
      providers: Array<{ name: string; configured: boolean }>;
      receiptMeaning: string;
    }>("/admin/console/push/overview"),
  devices: (id: string) =>
    apiClient<{
      items: Array<{
        id: string;
        provider: string;
        platform: string;
        appVersion: string | null;
        disabledAt: string | null;
        updatedAt: string;
      }>;
    }>(`/admin/console/push/devices/${encodeURIComponent(id)}`),
  announcements: () =>
    apiClient<{
      items: Array<{ id: string; content: string; createdAt: string }>;
    }>("/admin/console/push/announcements"),
  timeline: (id: string, q: URLSearchParams) =>
    apiClient<
      Page<Event> & {
        sessions: Array<{
          id: string;
          audience: string;
          deviceName: string | null;
          createdAt: string;
          revokedAt: string | null;
          expiredAt: string;
        }>;
        devices: Array<{
          id: string;
          deviceName: string | null;
          lastSeenAt: string;
          revokedAt: string | null;
        }>;
        installations: Array<{
          id: string;
          platform: string;
          appVersion: string;
          build: number;
          channel: string;
          lastSeenAt: string;
        }>;
        collectionStartedAt: string | null;
      }
    >(`/admin/console/users/${encodeURIComponent(id)}/timeline?${q}`),
  analytics: (days: number) =>
    apiClient<{
      generatedAt: string;
      timezone: string;
      collectionStartedAt: string | null;
      daily: Array<{ day: string; users: number; events: number }>;
      features: Array<{
        name: string;
        source: string;
        users: number;
        events: number;
      }>;
      retention: Array<{ day: number; eligible: number; returned: number }>;
      funnel: {
        registered: number;
        opened: number;
        joined: number;
        messaged: number;
      };
      definitions: Record<string, string>;
    }>(`/admin/console/analytics?days=${days}`),
  events: (q: URLSearchParams) =>
    apiClient<Page<Event>>(`/admin/console/events?${q}`),
  diagnostics: (q: URLSearchParams) =>
    apiClient<Page<Audit>>(`/admin/console/diagnostics?${q}`),
  releases: () =>
    apiClient<{
      releases: Release[];
      plans: Plan[];
      versions: Array<{
        platform: string;
        channel: string;
        appVersion: string;
        build: number;
        _count: number;
      }>;
      versionWindowDays: number;
    }>("/admin/console/releases"),
  preview: (q: URLSearchParams) =>
    apiClient<{ update: unknown; mandatory: boolean }>(
      `/admin/console/releases/preview?${q}`,
    ),
  keys: () => apiClient<{ items: Key[] }>("/admin/console/keys"),
  createKey: (body: unknown) =>
    apiClient<Key & { secret: string }>("/admin/console/keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
export function consoleWrite<T>(
  path: string,
  body: unknown,
  key: string,
  method = "POST",
) {
  return apiClient<T>(path, {
    method,
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}
