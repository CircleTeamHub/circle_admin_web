import { apiClient } from "./client";

export type NoteRatingCaseKind = "BURST" | "APPEAL";
export type NoteRatingCaseStatus = "PENDING" | "RESOLVED";
/** BURST: RELEASE / VOID. APPEAL: UPHOLD / REVOKE. VOID and REVOKE deduct 15 credit per rater. */
export type NoteRatingCaseAction = "RELEASE" | "VOID" | "UPHOLD" | "REVOKE";

export interface NoteRatingCaseUser {
  id: string;
  accountId: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface NoteRatingCaseRating {
  id: string;
  note: { id: string; title: string | null; status: string | null };
  rater: NoteRatingCaseUser & { creditScore: number; registeredAt: string };
  value: "GOOD" | "BAD";
  reason: string | null;
  comment: string | null;
  status: "COUNTED" | "HELD" | "VOID";
  createdAt: string;
}

export interface NoteRatingCase {
  id: string;
  kind: NoteRatingCaseKind;
  status: NoteRatingCaseStatus;
  owner: NoteRatingCaseUser;
  ownerReason: string | null;
  resolution: NoteRatingCaseAction | null;
  resolutionNote: string | null;
  resolvedBy: NoteRatingCaseUser | null;
  resolvedAt: string | null;
  createdAt: string;
  ratings: NoteRatingCaseRating[];
}

export interface NoteRatingCasePage {
  items: NoteRatingCase[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function listNoteRatingCases(params: {
  status: NoteRatingCaseStatus;
  kind?: NoteRatingCaseKind;
  page: number;
  limit: number;
}): Promise<NoteRatingCasePage> {
  const search = new URLSearchParams({
    status: params.status,
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.kind) search.set("kind", params.kind);
  return apiClient<NoteRatingCasePage>(`/admin/note-ratings/cases?${search}`);
}

export function resolveNoteRatingCase(
  caseId: string,
  action: NoteRatingCaseAction,
  note?: string,
): Promise<NoteRatingCase> {
  return apiClient<NoteRatingCase>(
    `/admin/note-ratings/cases/${encodeURIComponent(caseId)}/resolve`,
    { method: "POST", body: JSON.stringify({ action, note }) },
  );
}
