import { describe, expect, it } from "vitest";
import { normalizeUserListResponse } from "./users";

describe("normalizeUserListResponse", () => {
  it("normalizes backend data arrays to frontend items", () => {
    expect(
      normalizeUserListResponse({
        data: [{ id: "u1", accountId: "admin", role: "ADMIN", status: "ACTIVE" }],
        total: 1,
        page: 1,
        limit: 20,
      }),
    ).toEqual({
      items: [{ id: "u1", accountId: "admin", role: "ADMIN", status: "ACTIVE" }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });
});
