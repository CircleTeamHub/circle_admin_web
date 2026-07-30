import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  disableCircle,
  listAdminCircles,
  listAdminGroups,
  requestGroupOperation,
  restoreCircle,
} from "./community";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("Admin community API", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    mockedApiClient.mockResolvedValue({});
  });

  it("lists filtered circles", async () => {
    await listAdminCircles({
      page: 2,
      limit: 20,
      search: "摄影",
      status: "DISABLED",
    });

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/community/circles?page=2&limit=20&search=%E6%91%84%E5%BD%B1&status=DISABLED",
    );
  });

  it.each([
    ["disable", disableCircle],
    ["restore", restoreCircle],
  ] as const)("submits a confirmed circle %s operation", async (path, action) => {
    await action("circle-1", "违规内容", "摄影圈", "request-1");

    expect(mockedApiClient).toHaveBeenCalledWith(
      `/admin/community/circles/circle-1/${path}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": "request-1" },
        body: JSON.stringify({
          reason: "违规内容",
          confirmation: "摄影圈",
        }),
      },
    );
  });

  it("lists OpenIM groups", async () => {
    await listAdminGroups({ page: 1, limit: 20, search: "group-1" });

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/community/groups?page=1&limit=20&search=group-1",
    );
  });

  it("submits a durable group operation", async () => {
    await requestGroupOperation(
      "group-1",
      "DISMISS",
      "诈骗群",
      "group-1",
      "request-2",
    );

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/community/groups/group-1/operations",
      {
        method: "POST",
        headers: { "Idempotency-Key": "request-2" },
        body: JSON.stringify({
          type: "DISMISS",
          reason: "诈骗群",
          confirmation: "group-1",
        }),
      },
    );
  });
});
