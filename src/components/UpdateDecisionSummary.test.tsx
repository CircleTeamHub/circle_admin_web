import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { UpdateDecisionSummary } from "./UpdateDecisionSummary";
it("does not confuse absence of a matching plan with having the latest version", () => {
  render(
    <UpdateDecisionSummary decision={{ update: null, mandatory: false }} />,
  );
  expect(screen.getByText("当前条件下没有可用更新")).toBeTruthy();
  expect(screen.queryByText("已是最新版本")).toBeNull();
});
it("explains mandatory updates using the target version", () => {
  render(
    <UpdateDecisionSummary
      decision={{
        update: { version: "1.2.3", notes: "修复登录" },
        mandatory: true,
      }}
    />,
  );
  expect(screen.getByText("需要更新后继续使用")).toBeTruthy();
  expect(screen.getByText("1.2.3")).toBeTruthy();
  expect(screen.getByText("技术详情（排查用）")).toBeTruthy();
});
