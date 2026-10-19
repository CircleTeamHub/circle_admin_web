import { expect, it } from "vitest";
import { displayLabel, membershipLabel, DISPLAY_LABELS } from "./display";
it("uses domain-specific meanings for shared wire codes", () => {
  expect(displayLabel("userStatus", "ACTIVE")).toBe("正常");
  expect(displayLabel("contentStatus", "ACTIVE")).toBe("进行中");
  expect(displayLabel("reportStatus", "APPROVED")).toBe("举报成立");
  expect(displayLabel("consoleRole", "SUPPORT")).toBe("客服管理员");
});
it("covers the actual analytics scope and encrypted device purposes", () => {
  expect(displayLabel("scope", "analytics")).toBe("查看产品洞察");
  expect(displayLabel("devicePurpose", "AUDIT")).toBe("管理员审计设备");
  expect(displayLabel("messageType", "encrypted-text")).toBe("加密文字");
});

it("does not turn unknown or absent values into success", () => {
  expect(displayLabel("userStatus", "FUTURE")).toBe("未识别值");
  expect(displayLabel("userStatus", null)).toBe("未记录");
  expect(displayLabel("userStatus", "toString")).toBe("未识别值");
});
it("preserves membership meanings", () => {
  expect(membershipLabel(0)).toBe("普通用户");
  expect(membershipLabel(4)).toBe("超级会员");
  expect(membershipLabel(50)).toContain("未识别");
});
it("all supported code domains have human-readable Chinese labels", () => {
  for (const labels of Object.values(DISPLAY_LABELS))
    for (const label of Object.values(labels))
      expect(/[\u4e00-\u9fff]/.test(label) || label === "iOS").toBe(true);
});
