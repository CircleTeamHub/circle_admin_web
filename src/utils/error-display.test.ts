import { expect, it } from "vitest";
import { ApiError } from "../api/client";
import { readableErrorMessage } from "./error-display";
it("explains HTTP failures without displaying database internals", () => {
  expect(
    readableErrorMessage(
      new ApiError("Invalid Prisma invocation src/auth", 500),
    ),
  ).toContain("服务暂时");
  expect(readableErrorMessage(new ApiError("Forbidden", 403))).toContain(
    "没有执行此操作的权限",
  );
  expect(readableErrorMessage(new ApiError("Bad Request", 400))).toContain(
    "请求参数",
  );
  expect(readableErrorMessage(new TypeError("Failed to fetch"))).toContain(
    "无法连接",
  );
});
it("preserves concise actionable business validation in Chinese", () => {
  expect(
    readableErrorMessage(new ApiError("结束时间不能早于开始时间", 400)),
  ).toBe("结束时间不能早于开始时间");
  expect(readableErrorMessage(new Error("lost response"))).toBe(
    "请求未完成，请稍后重试。",
  );
});
