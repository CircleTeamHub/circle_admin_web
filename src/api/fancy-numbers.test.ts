import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  addFancyNumberRecommendations,
  listFancyNumberRecommendations,
  reorderFancyNumberRecommendations,
  setFancyNumberRecommendation,
} from "./fancy-numbers";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("Admin fancy-number recommendation API", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedApiClient.mockResolvedValue({ items: [] });
  });

  it("loads the complete curated recommendation list", async () => {
    await listFancyNumberRecommendations();

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/mall/fancy-numbers/recommendations",
    );
  });

  it("normalizes values before adding recommendations", async () => {
    await addFancyNumberRecommendations([" ab12c3 ", "xy98z7"]);

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/mall/fancy-numbers/recommendations",
      {
        method: "POST",
        body: JSON.stringify({ values: ["AB12C3", "XY98Z7"] }),
      },
    );
  });

  it("toggles recommendation membership without changing inventory status", async () => {
    await setFancyNumberRecommendation("fancy-1", false);

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/mall/fancy-numbers/recommendations/fancy-1",
      {
        method: "PATCH",
        body: JSON.stringify({ recommended: false }),
      },
    );
  });

  it("submits both the observed and proposed orders", async () => {
    await reorderFancyNumberRecommendations(
      ["fancy-a", "fancy-b"],
      ["fancy-b", "fancy-a"],
    );

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/mall/fancy-numbers/recommendations/order",
      {
        method: "PUT",
        body: JSON.stringify({
          expectedIds: ["fancy-a", "fancy-b"],
          ids: ["fancy-b", "fancy-a"],
        }),
      },
    );
  });
});
