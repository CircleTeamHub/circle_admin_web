import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { ADMIN_NAVIGATION } from "../auth/admin-navigation";
import { AppLayout } from "./AppLayout";
import { logout } from "../api/auth";
import { clearSession, getSession, setSession } from "../auth/session";

vi.mock("../api/auth", () => ({ logout: vi.fn() }));

function deferredLogout() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { vi.mocked(logout).mockReset(); });
afterEach(() => { clearSession(); });

function renderLayout(permissions: AdminPermission[], initialEntry = "/") {
  return render(
    <QueryClientProvider client={new QueryClient()}><AdminAccessContext.Provider
      value={{ role: "OPERATIONS", permissions, version: 1 }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="login" element={<div>Login destination</div>} />
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
  it("revokes before clearing the session or navigating and prevents duplicate submissions", async () => {
    const tokens = { accessToken: "access", refreshToken: "refresh" };
    setSession(tokens);
    const pending = deferredLogout();
    vi.mocked(logout).mockReturnValue(pending.promise);
    renderLayout(["DASHBOARD"]);

    const button = screen.getByRole("button", { name: /退出/ });
    fireEvent.click(button);
    await waitFor(() => expect(logout).toHaveBeenCalledExactlyOnceWith("refresh"));
    expect(getSession()).toEqual(tokens);
    expect(screen.getByText("Dashboard destination")).toBeInTheDocument();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(logout).toHaveBeenCalledTimes(1);

    await act(async () => { pending.resolve(); });
    expect(await screen.findByText("Login destination")).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });

  it("retains the session on revocation failure, shows a generic error, and allows retry", async () => {
    const tokens = { accessToken: "access", refreshToken: "refresh" };
    setSession(tokens);
    vi.mocked(logout).mockRejectedValueOnce(new Error("private server detail"))
      .mockResolvedValueOnce(undefined);
    renderLayout(["DASHBOARD"]);

    fireEvent.click(screen.getByRole("button", { name: /退出/ }));

    expect(await screen.findByText("退出失败，请重试")).toBeInTheDocument();
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
    expect(getSession()).toEqual(tokens);
    expect(screen.getByText("Dashboard destination")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /退出/ });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(await screen.findByText("Login destination")).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(2);
    expect(getSession()).toBeNull();
  });

  it("does not clear or navigate away from a replacement session after late logout success", async () => {
    setSession({ accessToken: "access-a", refreshToken: "refresh-a" });
    const pending = deferredLogout();
    vi.mocked(logout).mockReturnValue(pending.promise);
    renderLayout(["DASHBOARD"]);
    fireEvent.click(screen.getByRole("button", { name: /退出/ }));
    await waitFor(() => expect(logout).toHaveBeenCalledWith("refresh-a"));
    const replacement = { accessToken: "access-b", refreshToken: "refresh-b" };
    act(() => { setSession(replacement); });

    await act(async () => { pending.resolve(); });

    expect(getSession()).toEqual(replacement);
    expect(screen.getByText("Dashboard destination")).toBeInTheDocument();
    expect(screen.queryByText("Login destination")).not.toBeInTheDocument();
  });

  it("shows role and identity without environment or nickname editing controls",()=>{
    renderLayout(["DASHBOARD"]);
    expect(screen.getByText("Admin")).toHaveAttribute("title","账号：admin");
    expect(screen.queryByText("admin",{exact:true})).not.toBeInTheDocument();
    expect(screen.queryByText("本地开发")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "修改昵称" })).not.toBeInTheDocument();
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
