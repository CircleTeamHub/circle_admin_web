import { apiClient } from "./client";
import type { FriendReport, PageResult, ReportStatus, ReviewDecision } from "../types";

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
  return apiClient<PageResult<FriendReport>>(`/admin/friend-reports?${search}`);
}

export function reviewFriendReport(
  reportId: string,
  decision: ReviewDecision,
  note?: string,
): Promise<FriendReport> {
  return apiClient<FriendReport>(`/admin/friend-reports/${reportId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
}
