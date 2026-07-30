import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboard, type AdminDashboard } from "../api/dashboard";
import { DashboardPage } from "./DashboardPage";

vi.mock("../api/dashboard", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/dashboard")>();
  return { ...original, getDashboard: vi.fn() };
});

const mockedGetDashboard = vi.mocked(getDashboard);

const dashboard: AdminDashboard = {
  range: "today" as const,
  timezone: "Asia/Shanghai",
  generatedAt: "2026-07-29T12:00:00.000Z",
  startAt: "2026-07-28T16:00:00.000Z",
  endAt: "2026-07-29T12:00:00.000Z",
  sections: {
    users: {
      status: "ok" as const,
      data: {
        totalUsers: 12580,
        newUsers: 186,
        activeUsers: 3204,
        bannedUsers: 42,
        signupTrend: [
          { date: "2026-07-29", value: 186 },
        ],
      },
    },
    community: {
      status: "ok" as const,
      data: {
        totalCircles: 928,
        newCircles: 18,
        newPosts: 1246,
        newMembers: 738,
      },
    },
    commerce: {
      status: "ok" as const,
      data: {
        activeMembers: 1083,
        newMemberships: 76,
        activeFancyNumbers: 346,
        fancyNumberOrders: 92,
        fancyNumberSpend: 9200,
        expansionOrders: 48,
        expansionSpend: 9600,
        pointSpend: 18600,
        pointRecharge: 26000,
      },
    },
    moderation: {
      status: "ok" as const,
      data: {
        pendingFriendReports: 12,
        pendingGroupReports: 5,
        pendingPostReports: 4,
        pendingTotal: 21,
      },
    },
    system: {
      status: "ok" as const,
      data: {
        pending: 3,
        processing: 1,
        failed: 2,
        oldestPendingAt: "2026-07-29T11:00:00.000Z",
        oldestFailedAt: null,
        services: {
          api: "healthy",
          database: "healthy",
          redis: "healthy",
          openim: "healthy",
        },
      },
    },
  },
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockedGetDashboard.mockReset();
    mockedGetDashboard.mockResolvedValue(dashboard);
  });

  it("shows user, commerce, moderation, and system metrics", async () => {
    renderPage();

    expect(await screen.findByText("12,580")).toBeInTheDocument();
    expect(screen.getByText("积分消费")).toBeInTheDocument();
    expect(screen.getByText("商城经营")).toBeInTheDocument();
    expect(screen.getByText("治理与系统健康")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("OpenIM")).toBeInTheDocument();
  });

  it("reloads the dashboard when the range changes", async () => {
    renderPage();
    await screen.findByText("12,580");

    fireEvent.click(screen.getByText("最近 7 天"));

    await waitFor(() => expect(mockedGetDashboard).toHaveBeenCalledWith("7d"));
  });

  it("keeps healthy sections visible when one section fails", async () => {
    mockedGetDashboard.mockResolvedValue({
      ...dashboard,
      sections: {
        ...dashboard.sections,
        commerce: { status: "error", data: null },
      },
    });
    renderPage();

    expect(await screen.findByText("12,580")).toBeInTheDocument();
    expect(screen.getByText("商城数据暂时不可用")).toBeInTheDocument();
  });

  it("reports system health as unknown when the dashboard request fails", async () => {
    mockedGetDashboard.mockRejectedValue(new Error("network unavailable"));

    renderPage();

    expect(
      await screen.findByText("Dashboard 加载失败"),
    ).toBeInTheDocument();
    expect(screen.getByText("系统状态尚未获取")).toBeInTheDocument();
    expect(screen.queryByText("API 异常")).not.toBeInTheDocument();
    expect(screen.queryByText("数据库异常")).not.toBeInTheDocument();
    expect(screen.queryByText("Redis 异常")).not.toBeInTheDocument();
    expect(screen.queryByText("OpenIM 异常")).not.toBeInTheDocument();
  });

  it("keeps headline metrics unknown when their source sections are unavailable", async () => {
    mockedGetDashboard.mockResolvedValue({
      ...dashboard,
      sections: {
        ...dashboard.sections,
        users: { status: "error", data: null },
        commerce: { status: "error", data: null },
        moderation: { status: "error", data: null },
        system: { status: "error", data: null },
      },
    });

    renderPage();

    for (const title of [
      "用户总数",
      "活跃用户",
      "积分消费",
      "待处理事项",
    ]) {
      const card = (await screen.findByText(title)).closest(".ant-statistic");
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByText("--")).toBeInTheDocument();
    }
  });
});
