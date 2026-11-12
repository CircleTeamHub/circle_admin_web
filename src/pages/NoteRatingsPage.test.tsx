import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { NoteRatingsPage } from "./NoteRatingsPage";
import { AdminAccessContext } from "../auth/admin-access";
import { ApiError } from "../api/client";
import { listNoteRatingCases, resolveNoteRatingCase, type NoteRatingCase } from "../api/note-ratings";

vi.mock("../api/note-ratings", () => ({ listNoteRatingCases: vi.fn(), resolveNoteRatingCase: vi.fn() }));

const user = (id: string, nickname: string) => ({ id, accountId: `acc-${id}`, nickname, avatarUrl: null });

const burst: NoteRatingCase = {
  id: "case-burst",
  kind: "BURST",
  status: "PENDING",
  owner: user("owner-1", "老板"),
  ownerReason: null,
  resolution: null,
  resolutionNote: null,
  resolvedBy: null,
  resolvedAt: null,
  createdAt: "2026-11-11T02:00:00Z",
  ratings: [
    {
      id: "r1",
      note: { id: "note-1", title: "饺子馆", status: "ACTIVE" },
      rater: { ...user("rater-1", "小号一"), creditScore: 100, registeredAt: "2026-11-01T00:00:00Z" },
      value: "GOOD",
      reason: null,
      comment: null,
      status: "HELD",
      createdAt: "2026-11-11T01:58:00Z",
    },
    {
      id: "r2",
      note: { id: "note-gone", title: null, status: null },
      rater: { ...user("rater-2", "小号二"), creditScore: 95, registeredAt: "2026-11-02T00:00:00Z" },
      value: "GOOD",
      reason: null,
      comment: null,
      status: "HELD",
      createdAt: "2026-11-11T01:59:00Z",
    },
  ],
};

const appeal: NoteRatingCase = {
  ...burst,
  id: "case-appeal",
  kind: "APPEAL",
  ownerReason: "店已经重新开业",
  ratings: [
    {
      ...burst.ratings[0],
      id: "r9",
      value: "BAD",
      reason: "EXPIRED",
      comment: "关门了",
      status: "COUNTED",
    },
  ],
};

function renderPage(path = "/note-ratings") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <AdminAccessContext.Provider value={{ role: "MODERATOR", permissions: ["USER_READ", "MODERATION_MANAGE"], version: 1 }}>
          <NoteRatingsPage />
        </AdminAccessContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("lists pending cases and shows who rated whom, when, as evidence", async () => {
  vi.mocked(listNoteRatingCases).mockResolvedValue({ items: [burst], total: 1, page: 1, limit: 20, hasMore: false });
  renderPage();

  expect(await screen.findByText("2 条好评")).toBeInTheDocument();
  expect(listNoteRatingCases).toHaveBeenCalledWith({ status: "PENDING", kind: undefined, page: 1, limit: 20 });
  expect(screen.getByRole("link", { name: "老板" })).toHaveAttribute("href", "/users/owner-1");

  fireEvent.click(screen.getByRole("button", { name: /证\s*据/ }));

  const drawer = await screen.findByRole("dialog");
  expect(within(drawer).getByRole("link", { name: "小号一" })).toHaveAttribute("href", "/users/rater-1");
  expect(within(drawer).getByText(/信用分 95/)).toBeInTheDocument();
  expect(within(drawer).getByText("饺子馆")).toBeInTheDocument();
  expect(within(drawer).getByText("笔记已永久删除")).toBeInTheDocument();
  expect(within(drawer).getAllByText("暂扣")).toHaveLength(2);
});

it("filters by kind through the URL", async () => {
  vi.mocked(listNoteRatingCases).mockResolvedValue({ items: [appeal], total: 1, page: 1, limit: 20, hasMore: false });
  renderPage("/note-ratings?kind=APPEAL&status=RESOLVED");

  expect(await screen.findByText("1 条差评")).toBeInTheDocument();
  expect(listNoteRatingCases).toHaveBeenCalledWith({ status: "RESOLVED", kind: "APPEAL", page: 1, limit: 20 });
});

it("voids a burst after confirming the credit deduction", async () => {
  vi.mocked(listNoteRatingCases).mockResolvedValue({ items: [burst], total: 1, page: 1, limit: 20, hasMore: false });
  vi.mocked(resolveNoteRatingCase).mockResolvedValue({ ...burst, status: "RESOLVED", resolution: "VOID" });
  renderPage();

  // A burst offers release and void, never the appeal actions.
  // antd spaces out two-character Chinese labels ("放 行").
  expect(await screen.findByRole("button", { name: /放\s*行/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "维持差评" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "作废并扣分" }));

  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/扣 15 信用分/)).toBeInTheDocument();
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: " 同一设备批量注册 " } });
  fireEvent.click(within(dialog).getByRole("button", { name: /确\s*认/ }));

  await waitFor(() => expect(resolveNoteRatingCase).toHaveBeenCalledWith("case-burst", "VOID", "同一设备批量注册"));
});

it("offers uphold / revoke on an appeal and explains a case another admin already resolved", async () => {
  vi.mocked(listNoteRatingCases).mockResolvedValue({ items: [appeal], total: 1, page: 1, limit: 20, hasMore: false });
  vi.mocked(resolveNoteRatingCase).mockRejectedValue(
    new ApiError("Rating case already resolved", 409, { errorCode: "NOTE_RATING_CASE_RESOLVED" }),
  );
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "撤销差评并扣分" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /确\s*认/ }));

  expect(await screen.findByText("该审核单已被其他管理员处理，列表已刷新")).toBeInTheDocument();
  expect(resolveNoteRatingCase).toHaveBeenCalledWith("case-appeal", "REVOKE", undefined);
  expect(listNoteRatingCases).toHaveBeenCalledTimes(2);
});
