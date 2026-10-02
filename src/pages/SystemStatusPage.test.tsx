import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboard, type AdminDashboard } from "../api/dashboard";
import { SystemStatusPage } from "./SystemStatusPage";

vi.mock("../api/dashboard", () => ({ getDashboard: vi.fn() }));

const mockedGetDashboard = vi.mocked(getDashboard);
const dashboard: AdminDashboard = {
  range: "today",
  timezone: "Asia/Shanghai",
  generatedAt: "2026-07-29T12:00:00.000Z",
  startAt: "2026-07-28T16:00:00.000Z",
  endAt: "2026-07-29T12:00:00.000Z",
  sections: {
    users: { status: "error", data: null },
    community: { status: "error", data: null },
    commerce: { status: "error", data: null },
    moderation: { status: "error", data: null },
    system: {
      status: "ok",
      data: { services: { api: "healthy", database: "down", redis: "healthy" } },
    },
  },
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SystemStatusPage />
    </QueryClientProvider>,
  );
}

describe("SystemStatusPage", () => {
  beforeEach(() => {
    mockedGetDashboard.mockReset();
    mockedGetDashboard.mockResolvedValue(dashboard);
  });

  it("reports the actual service probes without the retired outbox queue panels", async () => {
    renderPage();

    await screen.findByText("API");
    for (const [service, status] of [
      ["API", "正常"],
      ["数据库", "异常"],
      ["Redis", "正常"],
    ]) {
      const item = screen.getByText(service).closest(".ant-descriptions-item");
      expect(item).not.toBeNull();
      expect(within(item as HTMLElement).getByText(status)).toBeInTheDocument();
    }
    expect(mockedGetDashboard).toHaveBeenCalledWith("today");
    expect(screen.queryByText("Outbox")).not.toBeInTheDocument();
    expect(screen.queryByText("friend outbox")).not.toBeInTheDocument();
    expect(screen.queryByText("group outbox")).not.toBeInTheDocument();
  });

  it("reports a failed request without inventing service health", async () => {
    mockedGetDashboard.mockRejectedValue(new Error("network unavailable"));

    renderPage();

    expect(await screen.findByText("系统状态加载失败")).toBeInTheDocument();
    expect(screen.queryByText("正常")).not.toBeInTheDocument();
    expect(screen.queryByText("异常")).not.toBeInTheDocument();

    mockedGetDashboard.mockResolvedValue(dashboard);
    fireEvent.click(screen.getByRole("button", { name: "重 试" }));

    expect(await screen.findByText("API")).toBeInTheDocument();
    expect(screen.queryByText("系统状态加载失败")).not.toBeInTheDocument();
    expect(mockedGetDashboard).toHaveBeenCalledTimes(2);
  });

  it("reports an unavailable system section without inventing service health", async () => {
    mockedGetDashboard.mockResolvedValue({
      ...dashboard,
      sections: { ...dashboard.sections, system: { status: "error", data: null } },
    });

    renderPage();

    expect(await screen.findByText("系统指标暂时不可用，请刷新重试。")).toBeInTheDocument();
    expect(screen.queryByText("正常")).not.toBeInTheDocument();
    expect(screen.queryByText("异常")).not.toBeInTheDocument();
  });
});
