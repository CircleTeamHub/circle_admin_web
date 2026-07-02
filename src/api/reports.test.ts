import { describe, expect, it } from "vitest";
import { normalizeFriendReport } from "./reports";

describe("normalizeFriendReport", () => {
  it("maps backend target and reviewedBy fields to page-friendly aliases", () => {
    const report = normalizeFriendReport({
      id: "r1",
      category: "spam",
      description: "bad actor",
      evidence: [],
      status: "PENDING",
      createdAt: "2026-07-02T00:00:00.000Z",
      reviewedAt: null,
      reviewNote: null,
      reporter: { id: "u1", accountId: "alice", nickname: "Alice", avatarUrl: null },
      target: { id: "u2", accountId: "bob", nickname: "Bob", avatarUrl: null },
      reviewedBy: null,
    });

    expect(report.targetUser?.accountId).toBe("bob");
    expect(report.reviewer).toBeNull();
  });
});
