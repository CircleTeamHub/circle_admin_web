import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { VipRechargePage } from "./VipRechargePage";
vi.mock("./MembershipsPage", () => ({ MembershipsPage: () => <div>VIP内容</div> }));
vi.mock("./SupportRechargePage", () => ({ SupportRechargePage: () => <div>充值内容</div> }));
vi.mock("./InvitesPage", () => ({ InvitesPage: () => <div>邀请奖励内容</div> }));
function show(permissions: AdminPermission[], path = "/memberships") {
  render(<AdminAccessContext.Provider value={{ role: "OPERATIONS", permissions, version: 1 }}><MemoryRouter initialEntries={[path]}><VipRechargePage /></MemoryRouter></AdminAccessContext.Provider>);
}
it("switches between VIP and recharge under one heading", async () => {
  show(["COMMERCE_MANAGE", "RECHARGE_MANAGE"]);
  expect(screen.getByRole("heading", { name: "VIP和充值管理" })).toBeVisible();
  expect(screen.getByText("VIP内容")).toBeVisible();
  expect(screen.queryByText("充值内容")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "充值管理" }));
  expect(await screen.findByText("充值内容")).toBeVisible();
  expect(screen.queryByText("VIP内容")).not.toBeInTheDocument();
});
it.each([
  [["RECHARGE_MANAGE"], "充值管理", "VIP管理"],
  [["COMMERCE_MANAGE"], "VIP管理", "充值管理"],
  [["CONTENT_MANAGE"], "邀请奖励", "VIP管理"],
] as [AdminPermission[], string, string][])("only mounts authorized content for %s", (permissions, allowed, hidden) => {
  show(permissions);
  expect(screen.getByRole("tab", { name: allowed })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: hidden })).not.toBeInTheDocument();
});
it("opens recharge directly from its existing URL", () => {
  show(["COMMERCE_MANAGE", "RECHARGE_MANAGE"], "/recharge");
  expect(screen.getByText("充值内容")).toBeVisible();
  expect(screen.queryByText("VIP内容")).not.toBeInTheDocument();
});
it("denies access without either permission", () => {
  show([]);
  expect(screen.getByText("当前管理员无此功能权限")).toBeVisible();
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
});

it("opens invitation rewards from the combined page and preserves the old URL", async () => {
  show(["COMMERCE_MANAGE", "RECHARGE_MANAGE", "CONTENT_MANAGE"], "/invites");
  expect(screen.getByRole("tab", { name: "邀请奖励" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("邀请奖励内容")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "VIP管理" }));
  expect(await screen.findByText("VIP内容")).toBeVisible();
  expect(screen.queryByText("邀请奖励内容")).not.toBeInTheDocument();
});
it("hides invitation rewards without its original permission", () => {
  show(["COMMERCE_MANAGE", "RECHARGE_MANAGE"]);
  expect(screen.queryByRole("tab", { name: "邀请奖励" })).not.toBeInTheDocument();
  expect(screen.queryByText("邀请奖励内容")).not.toBeInTheDocument();
});
