import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  getUserDetail,
  listUserAuditLogs,
  listUsers,
  revealSensitiveField,
  updateUserStatus,
  userListQueryString,
} from "./users";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("Admin user API", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("builds a trimmed list query and calls the dedicated Admin route", async () => {
    mockedApiClient.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    await listUsers({ keyword: "  jim  ", page: 1, limit: 20 });

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/users?keyword=jim&page=1&limit=20",
    );
  });

  it("omits empty filters and includes all supported filters", () => {
    expect(
      userListQueryString({
        keyword: "  ",
        status: "BANNED",
        role: "MEMBER",
        createdFrom: "2026-01-01T00:00:00.000Z",
        createdTo: "2026-02-01T00:00:00.000Z",
        page: 2,
        limit: 50,
      }),
    ).toBe(
      "status=BANNED&role=MEMBER&createdFrom=2026-01-01T00%3A00%3A00.000Z&createdTo=2026-02-01T00%3A00%3A00.000Z&page=2&limit=50",
    );
  });

  it("loads the 360-degree detail", async () => {
    mockedApiClient.mockResolvedValue({});

    await getUserDetail("u1");

    expect(mockedApiClient).toHaveBeenCalledWith("/admin/users/u1");
  });

  it("reveals one sensitive field with an audit reason", async () => {
    mockedApiClient.mockResolvedValue({});

    await revealSensitiveField("u1", {
      field: "phoneNumber",
      reason: "CS-1024",
    });

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/users/u1/sensitive-access",
      {
        method: "POST",
        body: JSON.stringify({ field: "phoneNumber", reason: "CS-1024" }),
      },
    );
  });

  it("changes status through the audited Admin route", async () => {
    mockedApiClient.mockResolvedValue({});

    await updateUserStatus("u1", {
      status: "BANNED",
      reason: "abuse",
    });

    expect(mockedApiClient).toHaveBeenCalledWith("/admin/users/u1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "BANNED", reason: "abuse" }),
    });
  });

  it("loads bounded user audit history", async () => {
    mockedApiClient.mockResolvedValue([]);

    await listUserAuditLogs("u1", 20);

    expect(mockedApiClient).toHaveBeenCalledWith(
      "/admin/users/u1/audit-logs?limit=20",
    );
  });
});
