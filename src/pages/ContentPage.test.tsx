import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ContentPage } from "./ContentPage";
import { AdminAccessContext } from "../auth/admin-access";
import { getPost, listPosts } from "../api/moderation";
vi.mock("../api/moderation", () => ({
  getPost: vi.fn(),
  listPosts: vi.fn(),
  moderatePost: vi.fn(),
}));
it("replaces report metrics with signup counts and roster entry points in list and details", async () => {
  const post = {
    id: "post-1",
    content: "周末一起骑行",
    images: [],
    tags: [],
    status: "ACTIVE" as const,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
    circle: { id: "circle-1", name: "骑行圈" },
    author: { id: "user-1", nickname: "小明", accountId: "xiaoming" },
    signupCount: 3,
  };
  vi.mocked(listPosts).mockResolvedValue({
    items: [post],
    total: 1,
    page: 1,
    limit: 20,
  } as Awaited<ReturnType<typeof listPosts>>);
  vi.mocked(getPost).mockResolvedValue(
    post as Awaited<ReturnType<typeof getPost>>,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <AdminAccessContext.Provider
          value={{
            role: "SUPER_ADMIN",
            permissions: ["COMMUNITY_MANAGE", "USER_READ"],
            version: 1,
          }}
        >
          <ContentPage />
        </AdminAccessContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("3 人")).toBeInTheDocument();
  expect(screen.queryByText("举报数")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "查看报名名单" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /详\s*情/ }));
  expect(await screen.findByText("小明")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "查看报名名单" })).toHaveLength(
    2,
  );
  expect(screen.queryByText("举报数")).not.toBeInTheDocument();
});
