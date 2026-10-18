import { apiClient } from "./client";
import type { AdminCirclePost, PaginatedResult } from "./community";
export type UserResourceKind = "circles" | "groups" | "posts" | "notes";
export type UserResource =
  | {
      id: string;
      role: string;
      createdAt: string;
      circle: {
        id: string;
        name: string;
        deleted: boolean;
        memberCount: number;
        postCount: number;
        adminState: string;
      };
    }
  | {
      id: string;
      joinedAt: string;
      group: {
        id: string;
        name: string;
        memberCount: number;
        circle: { id: string; name: string; deleted: boolean } | null;
      };
    }
  | {
      id: string;
      content: string;
      status: string;
      createdAt: string;
      circle: { id: string; name: string };
    }
  | {
      id: string;
      title: string;
      status: string;
      available: boolean;
      workStatus: string | null;
      imageCount: number;
      videoCount: number;
      audioCount: number;
      isCollected: boolean;
      createdAt: string;
      updatedAt: string;
    };
export interface NoteMedia {
  id?: string;
  type: string;
  url?: string;
  posterUrl?: string | null;
  objectKey?: string;
}
export interface NoteCard {
  id: string;
  name: string;
  circleId?: string;
  conversationID?: string;
  faceURL?: string | null;
}
export interface AdminNoteDetail {
  id: string;
  ownerId: string;
  title: string;
  status: string;
  available: boolean;
  workStatus: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  content: string | null;
  contentJson?: unknown[] | null;
  media: NoteMedia[];
  groups: { id: string; name: string }[];
  sections: {
    text?: { content: string | null; contentJson: unknown[] | null };
    media?: { items: NoteMedia[] };
    showcase?: { items: NoteMedia[] };
    audio?: { items: NoteMedia[] };
    contacts?: { items: NoteCard[] };
    groups?: { items: NoteCard[] };
    location?: {
      title?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    } | null;
  };
}
export function getUserResources(
  userID: string,
  kind: UserResourceKind,
  page: number,
): Promise<PaginatedResult<UserResource>> {
  // Literal paths also keep the observability route allowlist auditable.
  const base = `/admin/users/${encodeURIComponent(userID)}`;
  const paths = {
    circles: `${base}/circles`,
    groups: `${base}/groups`,
    posts: `${base}/posts`,
    notes: `${base}/notes`,
  };
  return apiClient(`${paths[kind]}?page=${page}&limit=20`);
}
export function getUserPost(
  userID: string,
  id: string,
): Promise<AdminCirclePost> {
  return apiClient(
    `/admin/users/${encodeURIComponent(userID)}/posts/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
}
export function getUserNote(
  userID: string,
  id: string,
): Promise<AdminNoteDetail> {
  return apiClient(
    `/admin/users/${encodeURIComponent(userID)}/notes/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
}
