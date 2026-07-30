import { apiClient } from "./client";

export type FancyNumberStatus =
  | "AVAILABLE"
  | "LEASED"
  | "PERMANENT"
  | "DISABLED";

export type FancyNumberSource = "ADMIN" | "LEGACY" | "CUSTOM";

export interface FancyNumberRecommendation {
  id: string;
  value: string;
  status: FancyNumberStatus;
  source: FancyNumberSource;
  isRecommended: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FancyNumberRecommendationList {
  items: FancyNumberRecommendation[];
}

export function listFancyNumberRecommendations(): Promise<FancyNumberRecommendationList> {
  return apiClient<FancyNumberRecommendationList>(
    "/admin/mall/fancy-numbers/recommendations",
  );
}

export function addFancyNumberRecommendations(
  values: string[],
): Promise<FancyNumberRecommendationList> {
  return apiClient<FancyNumberRecommendationList>(
    "/admin/mall/fancy-numbers/recommendations",
    {
      method: "POST",
      body: JSON.stringify({
        values: values.map((value) => value.trim().toUpperCase()),
      }),
    },
  );
}

export function setFancyNumberRecommendation(
  id: string,
  recommended: boolean,
): Promise<FancyNumberRecommendation> {
  return apiClient<FancyNumberRecommendation>(
    `/admin/mall/fancy-numbers/recommendations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ recommended }),
    },
  );
}

export function reorderFancyNumberRecommendations(
  expectedIds: string[],
  ids: string[],
): Promise<FancyNumberRecommendationList> {
  return apiClient<FancyNumberRecommendationList>(
    "/admin/mall/fancy-numbers/recommendations/order",
    {
      method: "PUT",
      body: JSON.stringify({ expectedIds, ids }),
    },
  );
}
