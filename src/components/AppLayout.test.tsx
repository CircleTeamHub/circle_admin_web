import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { ADMIN_NAVIGATION } from "../auth/admin-navigation";
import { AppLayout } from "./AppLayout";

function renderLayout(permissions: AdminPermission[], initialEntry = "/") {
  return render(
    <QueryClientProvider client={new QueryClient()}><AdminAccessContext.Provider
      value={{ role: "OPERATIONS", permissions, version: 1 }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            element={
              <AppLayout
                user={{
                  id: "admin-1",
                  accountId: "admin",
                  nickname: "Admin",
                  role: "ADMIN",
                  status: "ACTIVE",
                }}
              />
            }
          >
            <Route path="community/groups/:conversationId" element={<div>Group destination</div>} />
            <Route path="invites" element={<div>Invitation destination</div>} />
            <Route index element={<div>Dashboard destination</div>} />
            <Route
              path="memberships"
              element={<div>Memberships destination</div>}
            />
            <Route
              path="recharge"
              element={<div>Recharge destination</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AdminAccessContext.Provider></QueryClientProvider>,
  );
}

describe("AppLayout", () => {
  it("shows role and identity without an environment badge",()=>{
    renderLayout(["DASHBOARD"]);
    expect(screen.getByText("Admin")).toHaveAttribute("title","账号：admin");
    expect(screen.queryByText("admin",{exact:true})).not.toBeInTheDocument();
    expect(screen.queryByText("本地开发")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修改昵称" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /退出/ })).toBeInTheDocument();
    expect(screen.getByText("运营")).toBeInTheDocument();
  });
  it("combines VIP and recharge navigation into one entry", async () => {
    renderLayout(["COMMERCE_MANAGE", "RECHARGE_MANAGE"]);
    expect(screen.queryByRole("menuitem", { name: /充值审核/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /VIP和充值管理/ }));
    expect(await screen.findByText("Memberships destination")).toBeInTheDocument();
  });

  it("hides navigation entries outside the administrator's permissions", async () => {
    renderLayout(["RECHARGE_MANAGE"]);

    expect(await screen.findByRole("menuitem", { name: /VIP和充值管理/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /热门靓号/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /管理员权限/ }),
    ).not.toBeInTheDocument();
  });
});

it("places group details under conversations while keeping circles separate", () => {
  renderLayout(["COMMUNITY_MANAGE", "IM_READ"], "/community/groups/group-id");
  expect(screen.getByRole("menuitem", { name: /会话与聊天记录/ })).toHaveClass("ant-menu-item-selected");
  expect(screen.getByRole("menuitem", { name: /圈子管理/ })).not.toHaveClass("ant-menu-item-selected");
});

it("keeps the combined menu selected on the recharge route", () => {
  renderLayout(["RECHARGE_MANAGE"], "/recharge");
  expect(screen.getByRole("menuitem", { name: /VIP和充值管理/ })).toHaveClass("ant-menu-item-selected");
});

it("groups invitation rewards under VIP and recharge for content-only administrators", () => {
  renderLayout(["CONTENT_MANAGE"], "/invites");
  expect(screen.getByRole("menuitem", { name: /VIP和充值管理/ })).toHaveClass("ant-menu-item-selected");
  expect(screen.queryByRole("menuitem", { name: /邀请码与邀请奖励/ })).not.toBeInTheDocument();
});

it("keeps every authorized navigation entry available after grouping", () => {
  const permissions = [...new Set(ADMIN_NAVIGATION.flatMap((item) => [item.permission, ...(item.additionalPermissions ?? [])]))];
  renderLayout(permissions);
  for (const item of ADMIN_NAVIGATION) {
    expect(screen.getByRole("menuitem", { name: new RegExp(item.label) })).toBeInTheDocument();
  }
  expect(screen.getByRole("link", { name: "跳到页面内容" })).toHaveAttribute("href", "#main-content");
});
