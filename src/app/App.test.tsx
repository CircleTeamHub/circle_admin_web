import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../api/auth";
import { clearSession, setSession } from "../auth/session";
import { App } from "./App";

vi.mock("../api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/auth")>();
  return { ...original, getMe: vi.fn() };
});

vi.mock("../pages/DashboardPage", () => ({
  DashboardPage: () => <div>dashboard-ready</div>,
}));

const mockedGetMe = vi.mocked(getMe);

describe("App authentication state", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    window.sessionStorage.clear();
    mockedGetMe.mockReset();
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

    act(() => clearSession());

    expect(await screen.findByText("管理员登录")).toBeInTheDocument();
  });
});
