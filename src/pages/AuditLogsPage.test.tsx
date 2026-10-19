import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AuditLogsPage } from "./AuditLogsPage";
import { platformList } from "../api/platform";
import { localDateTimeInput } from "./audit-presentation";
vi.mock("../api/platform", async (original) => ({
  ...(await original<typeof import("../api/platform")>()),
  platformList: vi.fn(),
}));
it("shows readable actions and allows full identifiers to be inspected in details", async () => {
  const requestId = "0576af4b-133f-4564-9321-7326761e28ae";
  vi.mocked(platformList).mockResolvedValue({
    items: [
      {
        id: "audit-1",
        actorID: "actor-1",
        actorAccountId: "admin",
        operator: null,
        action: "console.request.failed",
        entityType: "http_request",
        entityID: null,
        reason: null,
        requestId,
        createdAt: "2026-10-17T04:15:00Z",
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={["/audit-logs?from=2026-10-17T04%3A15%3A00Z"]}
      >
        <AuditLogsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText("后台请求失败");
  expect(screen.getByText("后台接口请求")).toBeTruthy();
  expect(screen.queryByText("0576af4b…")).toBeNull();
  expect(screen.queryByRole("button", {name:"诊断详情"})).not.toBeInTheDocument();
  expect(screen.queryByText("console.request.failed")).not.toBeInTheDocument();
  expect((screen.getByLabelText("开始时间") as HTMLInputElement).value).toBe(
    localDateTimeInput("2026-10-17T04:15:00Z"),
  );
  fireEvent.click(screen.getByRole("button", { name: "查看详情" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByText(requestId)).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByText("内部编号与操作代码（排查使用）"));
  expect(within(dialog).getByText(requestId)).toBeTruthy();
  expect(within(dialog).getByText("console.request.failed")).toBeTruthy();
  expect(within(dialog).getAllByText("未记录").length).toBeGreaterThan(0);
});

function renderAuditPage(entry = "/audit-logs") {
  vi.mocked(platformList).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><AuditLogsPage /></MemoryRouter></QueryClientProvider>);
}
it("submits readable operation choices and resets pagination", async () => {
  renderAuditPage("/audit-logs?page=3&actorID=actor-1");
  await screen.findByText("没有符合条件的操作记录，请调整筛选条件。");
  vi.mocked(platformList).mockClear();
  const action = screen.getByRole("combobox", { name: "操作类型" });
  fireEvent.mouseDown(action);
  fireEvent.change(action, { target: { value: "修改管理员昵称" } });
  fireEvent.click(await screen.findByText("修改管理员昵称"));
  fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));
  await waitFor(() => expect(platformList).toHaveBeenLastCalledWith("/admin/operations/audit-logs", expect.objectContaining({ action: "admin.nickname.update", actorID: "actor-1", page: 1 })));
  fireEvent.click(screen.getByRole("button", { name: /重\s*置/ }));
  await waitFor(() => expect(platformList).toHaveBeenLastCalledWith("/admin/operations/audit-logs", { page: 1, limit: 20 }));
});
it("rejects reversed dates before issuing a query", async () => {
  renderAuditPage();
  await screen.findByText("没有符合条件的操作记录，请调整筛选条件。");
  vi.mocked(platformList).mockClear();
  fireEvent.change(screen.getByLabelText("开始时间"), { target: { value: "2026-10-18T12:00" } });
  fireEvent.change(screen.getByLabelText("结束时间"), { target: { value: "2026-10-17T12:00" } });
  fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));
  expect(await screen.findByText("结束时间不能早于开始时间")).toBeVisible();
  expect(platformList).not.toHaveBeenCalled();
});

it.each(["IM_MEMBER_ROLE", "GROUP_MEMBER_ROLE_UPDATED"])("distinguishes duplicate audit labels and submits %s", async (code) => {
  renderAuditPage();
  await screen.findByText("没有符合条件的操作记录，请调整筛选条件。");
  const action = screen.getByRole("combobox", { name: "操作类型" });
  fireEvent.mouseDown(action);
  fireEvent.change(action, { target: { value: "调整群成员角色" } });
  fireEvent.click(await screen.findByText(`调整群成员角色（${code}）`));
  fireEvent.click(screen.getByRole("button", { name: /查\s*询/ }));
  await waitFor(() => expect(platformList).toHaveBeenLastCalledWith("/admin/operations/audit-logs", expect.objectContaining({ action: code })));
});
it('allows an unknown backend action code to be selected and queried',async()=>{
 renderAuditPage();await screen.findByText('没有符合条件的操作记录，请调整筛选条件。');
 const action=screen.getByRole('combobox',{name:'操作类型'});fireEvent.mouseDown(action);fireEvent.change(action,{target:{value:'CUSTOM_FUTURE'}});
 fireEvent.click(await screen.findByText('其他操作（CUSTOM_FUTURE）'));fireEvent.click(screen.getByRole('button',{name:/查\s*询/}));
 await waitFor(()=>expect(platformList).toHaveBeenLastCalledWith('/admin/operations/audit-logs',expect.objectContaining({action:'CUSTOM_FUTURE'})));
});
