import {AdminAccessContext} from "../auth/admin-access";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ReasonAction, useConsoleFilters } from "./console-shared";
import { useUrlValue } from "./use-url-value";
import { consoleWrite } from "../api/console";
import { PageError } from "../components/PageError";
import { ApiError } from "../api/client";
vi.mock("../api/console", async (original) => ({
  ...(await original<typeof import("../api/console")>()),
  consoleWrite: vi.fn(),
}));
beforeEach(() => vi.mocked(consoleWrite).mockReset());
function renderPage(
  node: React.ReactNode,
  entry = "/tasks?kind=notification_push&page=4",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}
it("reuses the operation key after a lost response and changes it only when the payload changes", async () => {
  vi.mocked(consoleWrite)
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValueOnce({ accepted: true });
  renderPage(
    <ReasonAction
      title="重试任务"
      path="/admin/console/push/11111111-1111-4111-8111-111111111111/retry"
      payload={{ version: "2026-10-17T00:00:00Z" }}
    />,
  );
  fireEvent.click(screen.getByText("重试任务"));
  fireEvent.change(screen.getByLabelText("操作原因"), {
    target: { value: "本地验收重试" },
  });
  fireEvent.click(screen.getByRole("button", { name: /OK|确.*定/ }));
  await screen.findByText("请求未完成，请稍后重试。");
  fireEvent.click(screen.getByRole("button", { name: /OK|确.*定/ }));
  await waitFor(() => expect(consoleWrite).toHaveBeenCalledTimes(2));
  expect(vi.mocked(consoleWrite).mock.calls[0][2]).toBe(
    vi.mocked(consoleWrite).mock.calls[1][2],
  );
});
it("restores filters from URL and changes a filter without retaining an obsolete page", () => {
  function Harness() {
    const [kind, setKind] = useUrlValue("kind", "notification_push", [
      "notification_push",
      "group_operation",
    ]);
    const [page] = useUrlValue<number>("page", 1);
    const location = useLocation();
    return (
      <>
        <span>
          {kind}:{page}
        </span>
        <button onClick={() => setKind("group_operation")}>switch</button>
        <output>{location.search}</output>
      </>
    );
  }
  renderPage(<Harness />);
  expect(screen.getByText("notification_push:4")).toBeTruthy();
  fireEvent.click(screen.getByText("switch"));
  expect(screen.getByText("group_operation:1")).toBeTruthy();
  expect(screen.getByRole("status").textContent).not.toContain("page=");
});
it("drops stale cursors on filters and preserves a cursor only for explicit pagination", () => {
  function Harness() {
    const { search, set } = useConsoleFilters();
    return (
      <>
        <output>{search.toString()}</output>
        <button onClick={() => set({ status: "FAILED" })}>filter</button>
        <button onClick={() => set({ cursor: "next" })}>next</button>
      </>
    );
  }
  renderPage(<Harness />, "/tasks?cursor=old&kind=notification_push");
  fireEvent.click(screen.getByText("filter"));
  expect(screen.getByRole("status").textContent).not.toContain("cursor=");
  fireEvent.click(screen.getByText("next"));
  expect(screen.getByRole("status").textContent).toContain("cursor=next");
});
it("provides a copyable diagnostic ID and a matching investigation link", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  renderPage(
    <AdminAccessContext.Provider value={{role:"SUPER_ADMIN",version:1,permissions:["AUDIT_READ"]}}><PageError
      error={new ApiError("Request unavailable", 503, undefined, id)}
    /></AdminAccessContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", {name:"诊断编号详情"}));
  expect(screen.getByTitle(id)).toBeTruthy();
  expect(screen.getByText("查看问题排查").getAttribute("href")).toBe(
    `/diagnostics?requestID=${id}`,
  );
});
