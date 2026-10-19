import { expect, it } from "vitest";
import {
  auditActionLabel,
  auditEntityLabel,
  localDateTimeInput,
} from "./audit-presentation";
it("explains known actions and safely falls back for new ones", () => {
  expect(auditActionLabel("admin.login.success")).toBe("管理员登录成功");
  expect(auditActionLabel("console.request.failed")).toBe("后台请求失败");
  expect(auditActionLabel("future")).toBe("其他管理操作");
  expect(auditEntityLabel("CircleMember")).toBe("圈子成员");
  expect(auditEntityLabel(null)).toBe("未记录对象");
});
it("converts persisted UTC filter times into local date inputs", () => {
  const value = "2026-10-17T04:15:00Z",
    date = new Date(value);
  const local = localDateTimeInput(value)!;
  expect(new Date(local).getTime()).toBe(date.getTime());
  expect(localDateTimeInput("bad")).toBeUndefined();
});
