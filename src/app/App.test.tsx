import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../api/auth";
import { apiClient } from "../api/client";
import { clearSession, setSession } from "../auth/session";
import { App } from "./App";

vi.mock("../api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/auth")>();
  return { ...original, getMe: vi.fn() };
});

vi.mock("../pages/DashboardPage", () => ({
  DashboardPage: () => <div>dashboard-ready</div>,
}));

vi.mock("../api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/client")>();
  return { ...original, apiClient: vi.fn() };
});

const mockedGetMe = vi.mocked(getMe);
const mockedApiClient = vi.mocked(apiClient);

describe("App authentication state", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    window.sessionStorage.clear();
    mockedGetMe.mockReset();
    mockedApiClient.mockReset();
    mockedApiClient.mockResolvedValue({
      role: "OPERATIONS",
      permissions: ["DASHBOARD"],
      version: 1,
    });
    mockedGetMe.mockResolvedValue({
      id: "admin-1",
      accountId: "admin",
      nickname: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
  });

  it("returns to login as soon as an expired session is cleared", async () => {
    setSession({ accessToken: "access", refreshToken: "refresh" });
    render(<App />);
    expect(await screen.findByText("dashboard-ready")).toBeInTheDocument();
    expect(mockedApiClient).toHaveBeenCalledWith("/admin/access/me");

    act(() => clearSession());

    expect(await screen.findByText("管理员登录")).toBeInTheDocument();
  });

  it("blocks the admin routes when permissions cannot be loaded", async () => {
    mockedApiClient.mockRejectedValue(new Error("access unavailable"));
    setSession({ accessToken: "access", refreshToken: "refresh" });

    render(<App />);

    expect(await screen.findByText("无法读取管理员权限")).toBeInTheDocument();
    expect(screen.queryByText("dashboard-ready")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
