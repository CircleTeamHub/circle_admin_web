import { apiClient } from "./client";
import type { AdminUser, FriendReport, PageResult, ReportStatus, ReviewDecision } from "../types";

type BackendFriendReport = Omit<FriendReport, "targetUser" | "reviewer"> & {
  target?: AdminUser | null;
  reviewedBy?: AdminUser | null;
};

type BackendFriendReportList = Omit<PageResult<BackendFriendReport>, "items"> & {
  items: BackendFriendReport[];
  hasMore?: boolean;
};

export function normalizeFriendReport(report: BackendFriendReport): FriendReport {
  return {
    ...report,
    evidence: report.evidence ?? [],
    targetUser: report.target ?? null,
    reviewer: report.reviewedBy ?? null,
  };
}

function normalizeFriendReportList(response: BackendFriendReportList): PageResult<FriendReport> {
  return {
    items: (response.items ?? []).map(normalizeFriendReport),
    total: response.total ?? 0,
    page: response.page ?? 1,
    limit: response.limit ?? 20,
    hasMore: response.hasMore,
  };
}

export function listFriendReports(params: {
  status: ReportStatus;
  page: number;
  limit: number;
}): Promise<PageResult<FriendReport>> {
  const search = new URLSearchParams({
    status: params.status,
    page: String(params.page),
    limit: String(params.limit),
  });
  return apiClient<BackendFriendReportList>(`/admin/friend-reports?${search}`).then(
    normalizeFriendReportList,
  );
}

export function reviewFriendReport(
  reportId: string,
  decision: ReviewDecision,
  note?: string,
): Promise<FriendReport> {
  return apiClient<BackendFriendReport>(`/admin/friend-reports/${reportId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  }).then(normalizeFriendReport);
}
