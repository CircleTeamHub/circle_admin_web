export type UserStatus = "ACTIVE" | "BANNED" | "DELETED";
export type UserRole = "USER" | "MEMBER" | "ADMIN";
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
  hasMore?: boolean;
}

export interface AdminUser {
  id: string;
  accountId: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
  status?: UserStatus;
  createdAt?: string;
  lastOnline?: string | null;
}

export interface AdminUserListItem {
  id: string;
  accountId: string;
  nickname: string;
  avatarUrl: string | null;
  maskedEmail: string | null;
  maskedPhoneNumber: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastOnline: string | null;
}

export type SensitiveField =
  | "email"
  | "phoneNumber"
  | "wechat"
  | "qq"
  | "whatsup";

export type MaskedContacts = Record<SensitiveField, string | null>;

export interface UserSecuritySummary {
  securityCodeLocked: boolean;
  singleDeviceLoginEnabled: boolean;
  activeSessionCount: number;
  activePushDeviceCount: number;
  openimSynced: boolean;
}

export interface UserBusinessSummary {
  creditScore: number;
  walletBalance: number;
  friendCount: number;
  noteCount: number;
  traceCount: number;
  circlesOwnedCount: number;
  circleMembershipCount: number;
  reportsFiledCount: number;
  reportsReceivedCount: number;
}

export interface AdminUserDetail {
  profile: {
    id: string;
    accountId: string;
    nickname: string;
    avatarUrl: string | null;
    role: UserRole;
    status: UserStatus;
    city: string | null;
    region: string | null;
    gender: "male" | "female" | "other" | "unset";
    createdAt: string;
    updatedAt: string;
    lastOnline: string | null;
  };
  maskedContacts: MaskedContacts;
  security: UserSecuritySummary;
  summary: UserBusinessSummary;
}

export interface SensitiveAccessResponse {
  field: SensitiveField;
  value: string | null;
  revealedAt: string;
  expiresAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string;
  actorAccountId: string;
  action: string;
  targetType: "user";
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminUpdateUserStatusPayload {
  status: UserStatus;
  reason: string;
  confirmationAccountId?: string;
}

export interface AdminUserStatusSummary {
  id: string;
  accountId: string;
  status: UserStatus;
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
