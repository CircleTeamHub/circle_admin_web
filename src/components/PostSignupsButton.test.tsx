import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { getPostSignups } from "../api/post-signups";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import { PostSignupsButton } from "./PostSignupsButton";
vi.mock("../api/post-signups", () => ({ getPostSignups: vi.fn() }));
function show(
  permissions: AdminPermission[] = ["COMMUNITY_MANAGE", "USER_READ"],
) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <AdminAccessContext.Provider
          value={{ role: "SUPER_ADMIN", permissions, version: 1 }}
        >
          <PostSignupsButton postID="post-1" />
        </AdminAccessContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPostSignups).mockResolvedValue({
    items: [
      {
        id: "internal-signup-id",
        createdAt: "2026-10-17T00:00:00Z",
        seenByAuthor: false,
        seenAt: null,
        user: {
          id: "user-1",
          nickname: "报名小明",
          accountId: "xiaoming",
          avatarUrl: null,
          status: "ACTIVE",
        },
      },
    ],
    total: 21,
    page: 1,
    limit: 20,
  });
});
it("loads on demand, shows readable applicant details and paginates", async () => {
  show();
  expect(getPostSignups).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "查看报名名单" }));
  expect(await screen.findByRole("link", { name: "报名小明" })).toHaveAttribute(
    "href",
    "/users/user-1",
  );
  expect(screen.getByText("xiaoming")).toBeInTheDocument();
  expect(screen.getByText("未查看")).toBeInTheDocument();
  expect(screen.queryByText("internal-signup-id")).not.toBeInTheDocument();
  fireEvent.click(screen.getByTitle("2"));
  await waitFor(() => expect(getPostSignups).toHaveBeenCalledWith("post-1", 2));
});
it("does not expose roster access or fetch without permission", () => {
  show(["USER_READ"]);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(getPostSignups).not.toHaveBeenCalled();
});
it("shows an explicit empty state", async () => {
  vi.mocked(getPostSignups).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });
  show();
  fireEvent.click(screen.getByRole("button", { name: "查看报名名单" }));
  expect(await screen.findByText("暂无报名")).toBeInTheDocument();
});
it("keeps failed loads retryable instead of showing no applicants", async () => {
  vi.mocked(getPostSignups).mockRejectedValueOnce(new Error("offline"));
  show();
  fireEvent.click(screen.getByRole("button", { name: "查看报名名单" }));
  const retry = await screen.findByRole("button", { name: /重\s*试/ });
  expect(screen.queryByText("暂无报名")).not.toBeInTheDocument();
  fireEvent.click(retry);
  expect(
    await screen.findByRole("link", { name: "报名小明" }),
  ).toBeInTheDocument();
});
