import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ReportsPage } from "./ReportsPage";
import { AdminAccessContext } from "../auth/admin-access";
import { getPost, listReports } from "../api/moderation";
vi.mock("../api/moderation", () => ({ listReports: vi.fn(), getPost: vi.fn(), reviewReport: vi.fn() }));
it.each(["friend", "group", "post"])("shows reporter identity and a profile link for %s reports", async (kind) => {
  vi.mocked(listReports).mockResolvedValue({items:[{id:"report-1", reporterID:"internal-user-id", reporter:{id:"internal-user-id",accountId:"circle123",nickname:"小明"}, status:"PENDING",createdAt:"2026-10-17T00:00:00Z"}],total:1,page:1,limit:20});
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[`/reports?kind=${kind}`]}><AdminAccessContext.Provider value={{role:"SUPER_ADMIN",permissions:["USER_READ","MODERATION_MANAGE"],version:1}}><ReportsPage /></AdminAccessContext.Provider></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole("link",{name:"小明"})).toHaveAttribute("href","/users/internal-user-id");
  expect(screen.getByText("账号 ID：circle123")).toBeInTheDocument();
  expect(screen.queryByText("internal-user-id")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:/详\s*情/}));
  expect(screen.getAllByRole("link",{name:"小明"})).toHaveLength(2);
});

const videoUrl = "https://example.test/circle/posts/user/ride.mov";

async function openReportedPost(buttonName = /^详\s*情$/) {
  const reporter = { id: "reporter-1", accountId: "reporter", nickname: "举报人" };
  const author = { id: "author-1", accountId: "xiaoming", nickname: "小明" };
  const circle = { id: "circle-1", name: "骑行圈" };
  vi.mocked(listReports).mockResolvedValue({
    items: [{
      id: "report-1",
      reporterID: reporter.id,
      reporter,
      postID: "post-1",
      circle,
      status: "PENDING",
      createdAt: "2026-10-17T00:00:00Z",
    }],
    total: 1,
    page: 1,
    limit: 20,
  });
  const post = {
    id: "post-1",
    content: "周末一起骑行",
    images: [],
    videos: [videoUrl, "javascript:alert(1)", "https://["],
    tags: [],
    status: "ACTIVE" as const,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
    author,
    circle,
    signupCount: 0,
  };
  vi.mocked(getPost).mockResolvedValue(post);

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/reports?kind=post"]}>
        <AdminAccessContext.Provider value={{ role: "SUPER_ADMIN", permissions: ["MODERATION_MANAGE"], version: 1 }}>
          <ReportsPage />
        </AdminAccessContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: buttonName }));
  expect(await screen.findByText("周末一起骑行")).toBeInTheDocument();
  return screen.getByLabelText("帖子视频 1");
}

it.each([/^详\s*情$/, /^帖子详情$/])("shows playable videos when opening a reported post with %s", async (buttonName) => {
  const player = await openReportedPost(buttonName);
  expect(player.tagName).toBe("VIDEO");
  expect(player).toHaveAttribute("src", videoUrl);
  expect(player).toHaveAttribute("controls");
  expect(player).toHaveAttribute("preload", "none");
  expect(player).not.toHaveAttribute("autoplay");
  expect(screen.queryByLabelText("帖子视频 2")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("帖子视频 3")).not.toBeInTheDocument();
});

it("offers the original video when browser playback fails", async () => {
  const player = await openReportedPost();
  expect(screen.queryByRole("link", { name: "打开原视频" })).not.toBeInTheDocument();

  fireEvent.error(player);

  expect(screen.getByRole("alert")).toHaveTextContent("视频无法播放");
  const original = screen.getByRole("link", { name: "打开原视频" });
  expect(original).toHaveAttribute("href", videoUrl);
  expect(original).toHaveAttribute("target", "_blank");
  expect(original).toHaveAttribute("rel", "noopener noreferrer");
});
