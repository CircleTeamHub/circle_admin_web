import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { getDashboard } from "./dashboard";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("Admin dashboard API", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedApiClient.mockResolvedValue({});
  });

  it("loads the selected dashboard range", async () => {
    await getDashboard("30d");

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/dashboard?range=30d",
    );
  });
});
