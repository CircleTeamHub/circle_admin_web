import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("formats empty values as a dash", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
  });

  it("returns a readable local date time", () => {
    expect(formatDateTime("2026-07-02T12:34:56.000Z")).toContain("2026");
  });
});
