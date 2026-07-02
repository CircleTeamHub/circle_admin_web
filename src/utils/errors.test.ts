import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("uses Error messages", () => {
    expect(getErrorMessage(new Error("failed"))).toBe("failed");
  });

  it("falls back for unknown values", () => {
    expect(getErrorMessage(null)).toBe("请求失败");
  });
});
