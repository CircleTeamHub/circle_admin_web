import { describe, expect, it } from "vitest";
import { toLocalDateTimeInput } from "./SupportRechargePage";

describe("SupportRechargePage time inputs", () => {
  it("formats a Date as the same local wall-clock time", () => {
    const date = new Date(2026, 7, 29, 9, 5, 0);
    expect(toLocalDateTimeInput(date)).toBe("2026-08-29T09:05");
  });

  it("returns an empty value for malformed saved timestamps", () => {
    expect(toLocalDateTimeInput("not-a-date")).toBe("");
  });
});
