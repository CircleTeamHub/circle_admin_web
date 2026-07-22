import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listUsers } from "../api/users";
import {
  initialUserListState,
  reduceUserListState,
  UsersPage,
} from "./UsersPage";

vi.mock("../api/users", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/users")>();
  return { ...original, listUsers: vi.fn() };
});

const mockedListUsers = vi.mocked(listUsers);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="/users" element={<UsersPage />} />
          <Route
            path="/users/:userId"
            element={<div>User detail destination</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UsersPage", () => {
  beforeEach(() => {
    mockedListUsers.mockReset();
    mockedListUsers.mockResolvedValue({
      items: [
        {
          id: "u1",
          accountId: "jim-1001",
          nickname: "Jim",
          avatarUrl: null,
          maskedEmail: "j***@example.com",
          maskedPhoneNumber: "*******5678",
          role: "USER",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastOnline: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it("resets pagination whenever a server-side filter changes", () => {
    const onPageTwo = { ...initialUserListState, page: 2 };

    expect(
      reduceUserListState(onPageTwo, {
        type: "filters",
        patch: { status: "BANNED" },
      }),
    ).toMatchObject({ page: 1, status: "BANNED" });
    expect(
      reduceUserListState(onPageTwo, { type: "page", page: 3 }),
    ).toMatchObject({ page: 3 });
  });

  it("renders masked contacts and only a detail action", async () => {
    renderPage();

    expect(await screen.findByText("j***@example.com")).toBeInTheDocument();
    expect(screen.getByText("*******5678")).toBeInTheDocument();
    expect(screen.queryByText("jim@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "封禁" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "解封" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "查看详情" }),
    ).toBeInTheDocument();
  });

  it("navigates to the selected user's detail route", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "查看详情" }),
    );

    expect(await screen.findByText("User detail destination")).toBeInTheDocument();
  });
});
