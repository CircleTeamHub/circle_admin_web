import { apiClient } from "./client";

export type DashboardRange = "today" | "7d" | "30d";

export interface DashboardUserMetrics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  bannedUsers: number;
  signupTrend: Array<{ date: string; value: number }>;
}

export interface DashboardCommunityMetrics {
  totalCircles: number;
  newCircles: number;
  newPosts: number;
  newMembers: number;
}

export interface DashboardCommerceMetrics {
  activeMembers: number;
  newMemberships: number;
  activeFancyNumbers: number;
  fancyNumberOrders: number;
  fancyNumberSpend: number;
  expansionOrders: number;
  expansionSpend: number;
  pointSpend: number;
  pointRecharge: number;
}

export interface DashboardModerationMetrics {
  pendingFriendReports: number;
  pendingGroupReports: number;
  pendingPostReports: number;
  pendingTotal: number;
}

export interface DashboardSystemMetrics {
  pending: number;
  processing: number;
  failed: number;
  oldestPendingAt: string | null;
  oldestFailedAt: string | null;
  services: {
    api: "healthy" | "down";
    database: "healthy" | "down";
    redis: "healthy" | "down";
    openim: "healthy" | "down";
  };
}

export type DashboardSection<T> =
  | { status: "ok"; data: T }
  | { status: "error"; data: null };

export interface AdminDashboard {
  range: DashboardRange;
  timezone: string;
  generatedAt: string;
  startAt: string;
  endAt: string;
  sections: {
    users: DashboardSection<DashboardUserMetrics>;
    community: DashboardSection<DashboardCommunityMetrics>;
    commerce: DashboardSection<DashboardCommerceMetrics>;
    moderation: DashboardSection<DashboardModerationMetrics>;
    system: DashboardSection<DashboardSystemMetrics>;
  };
}

export function getDashboard(range: DashboardRange): Promise<AdminDashboard> {
  return apiClient<AdminDashboard>(
    `/admin/dashboard?range=${encodeURIComponent(range)}`,
  );
}
