import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ReportsPage } from "./ReportsPage";
import { AdminAccessContext } from "../auth/admin-access";
import { listReports } from "../api/moderation";
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
