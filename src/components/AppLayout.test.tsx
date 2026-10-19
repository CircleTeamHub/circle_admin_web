import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { AppLayout } from "./AppLayout";

function renderLayout(permissions: AdminPermission[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}><AdminAccessContext.Provider
      value={{ role: "OPERATIONS", permissions, version: 1 }}
    >
      <MemoryRouter initialEntries={["/"]}>
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
  it("shows one identity label and keeps the account in its tooltip",()=>{
    renderLayout(["DASHBOARD"]);
    expect(screen.getByText("Admin")).toHaveAttribute("title","账号：admin");
    expect(screen.queryByText("admin",{exact:true})).not.toBeInTheDocument();
    expect(screen.getByText("本地开发")).toBeInTheDocument();
    expect(screen.getByText("运营")).toBeInTheDocument();
  });
  it("routes authorized administrators to memberships and recharge without retired fancy-number entries", async () => {
    renderLayout(["COMMERCE_MANAGE", "RECHARGE_MANAGE"]);

    expect(screen.queryByRole("menuitem", { name: /靓号/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /VIP 管理/ }));

    expect(
      await screen.findByText("Memberships destination"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /充值审核/ }));
    expect(await screen.findByText("Recharge destination")).toBeInTheDocument();
  });

  it("hides navigation entries outside the administrator's permissions", async () => {
    renderLayout(["RECHARGE_MANAGE"]);

    expect(await screen.findByRole("menuitem", { name: /充值审核/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /热门靓号/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /管理员权限/ }),
    ).not.toBeInTheDocument();
  });
});
