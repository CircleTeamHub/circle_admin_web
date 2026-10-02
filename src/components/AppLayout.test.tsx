import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { AppLayout } from "./AppLayout";

function renderLayout(permissions: AdminPermission[]) {
  return render(
    <AdminAccessContext.Provider
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
              path="fancy-numbers"
              element={<div>Fancy numbers destination</div>}
            />
            <Route
              path="recharge"
              element={<div>Recharge destination</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AdminAccessContext.Provider>,
  );
}

describe("AppLayout", () => {
  it("routes authorized administrators to fancy numbers and recharge", async () => {
    renderLayout(["COMMERCE_MANAGE", "RECHARGE_MANAGE"]);

    fireEvent.click(screen.getByRole("menuitem", { name: /热门靓号/ }));

    expect(
      await screen.findByText("Fancy numbers destination"),
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
