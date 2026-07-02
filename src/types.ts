export type UserStatus = "ACTIVE" | "BANNED" | "DELETED";
export type UserRole = "USER" | "ADMIN";
export type ReportStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "APPROVE" | "REJECT";

export interface AuthUser {
  id: string;
  userId?: string;
  accountId: string;
  nickname?: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUser {
  id: string;
  accountId: string;
  nickname?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  lastOnline?: string | null;
}

export interface FriendReport {
  id: string;
  category?: string;
  description?: string;
  evidence?: string[] | null;
  status: ReportStatus;
  createdAt: string;
  reporter?: AdminUser | null;
  targetUser?: AdminUser | null;
  reviewer?: AdminUser | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

export interface OutboxQueueHealth {
  pending?: number;
  processing?: number;
  failed?: number;
  oldestPendingAt?: string | null;
  oldestFailedAt?: string | null;
}

export interface OutboxHealth {
  friend?: OutboxQueueHealth;
  group?: OutboxQueueHealth;
  status?: string;
}
