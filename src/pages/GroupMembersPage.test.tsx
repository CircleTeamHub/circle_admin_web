import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { listImMembers, moderateImMember, type ImMember } from "../api/admin-im";
import { AdminAccessContext } from "../auth/admin-access";
import { GroupMembersPage } from "./GroupMembersPage";

vi.mock("../api/admin-im", () => ({
  listImMembers: vi.fn(),
  moderateImMember: vi.fn(),
}));

const member: ImMember = {
  id: "shared-member", nickname: "测试成员", role: "MEMBER", silenced: false,
  silencedUntil: null, joinedAt: "2026-01-01T00:00:00Z",
};

function show() {
  const router = createMemoryRouter([
    { path: "/im/conversations/:conversationId/members", element: <GroupMembersPage /> },
  ], {
    initialEntries: ["/im/conversations/A/members", "/im/conversations/B/members"],
    initialIndex: 1,
  });
  render(
    <AdminAccessContext.Provider value={{ role: "SUPER_ADMIN", permissions: ["IM_MODERATE", "USER_READ"], version: 1 }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AdminAccessContext.Provider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listImMembers).mockImplementation(async (id) => ({
    items: [member], total: 1, name: `群 ${id}`, circle: null,
  }));
  vi.mocked(moderateImMember).mockResolvedValue({ completed: true });
});

it("discards B's member draft on browser Back to A even when both groups contain the member", async () => {
  const router = show();
  await screen.findByRole("heading", { name: "群成员 · 群 B" });
  fireEvent.click(screen.getByRole("button", { name: "管理成员" }));
  fireEvent.change(screen.getByLabelText("操作原因"), { target: { value: "只处理群 B" } });
  expect(screen.getByRole("button", { name: "确认执行" })).toBeEnabled();

  await act(() => router.navigate(-1));
  await screen.findByRole("heading", { name: "群成员 · 群 A" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(moderateImMember).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "管理成员" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("操作原因")).toHaveValue("");
  const confirm = within(dialog).getByRole("button", { name: "确认执行" });
  expect(confirm).toBeDisabled();
  fireEvent.click(confirm);
  expect(moderateImMember).not.toHaveBeenCalled();
});

it("submits a normal member operation to B and refreshes its roster", async () => {
  show();
  fireEvent.click(await screen.findByRole("button", { name: "管理成员" }));
  fireEvent.change(screen.getByLabelText("操作原因"), { target: { value: " 正常禁言 " } });
  fireEvent.click(screen.getByRole("button", { name: "确认执行" }));
  await waitFor(() => expect(moderateImMember).toHaveBeenCalledExactlyOnceWith("B", member.id, "mute", "正常禁言", undefined));
  await waitFor(() => expect(listImMembers).toHaveBeenCalledTimes(2));
  expect(vi.mocked(listImMembers).mock.calls[1]).toEqual(["B", "", 1]);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
