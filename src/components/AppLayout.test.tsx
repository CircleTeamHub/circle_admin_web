import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  it("routes administrators to the fancy-number recommendation page", async () => {
    render(
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
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("menuitem", { name: /热门靓号/ }),
    );

    expect(
      await screen.findByText("Fancy numbers destination"),
    ).toBeInTheDocument();
  });
});
