import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { consoleApi } from "../api/console";
import { getDashboard, type AdminDashboard } from "../api/dashboard";
import { DashboardPage, LegacyInsightsRedirect } from "./DashboardPage";

vi.mock("../api/dashboard", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/dashboard")>();
  return { ...original, getDashboard: vi.fn() };
});

vi.mock("../api/console", () => ({ consoleApi: { analytics: vi.fn() } }));
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
        signupTrend: [{ date: "2026-07-29", value: 186 }],
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
        services: {
          api: "healthy",
          database: "healthy",
          redis: "healthy",
        },
      },
    },
  },
};

function renderPage(entry = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/insights" element={<LegacyInsightsRedirect />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(consoleApi.analytics).mockReset();
  vi.mocked(consoleApi.analytics).mockResolvedValue({
    generatedAt: "2026-10-17T00:00:00Z",
    timezone: "Asia/Shanghai",
    collectionStartedAt: null,
    daily: [],
    features: [],
    retention: [],
    funnel: { registered: 10, opened: 8, joined: 4, messaged: 2 },
    definitions: {},
  });
  mockedGetDashboard.mockReset();
  mockedGetDashboard.mockResolvedValue(dashboard);
});

describe("DashboardPage", () => {
  it("shows user, commerce, moderation, and system metrics", async () => {
    renderPage();

    expect(await screen.findByText("12,580")).toBeInTheDocument();
    expect(screen.getByText("积分消费")).toBeInTheDocument();
    expect(screen.getByText("会员与积分")).toBeInTheDocument();
    expect(screen.queryByText("使用中靓号")).not.toBeInTheDocument();
    expect(screen.getByText("举报处理与服务状态")).toBeInTheDocument();
    expect(screen.getByText("缓存服务")).toBeInTheDocument();
    expect(screen.getByText(/统计区间（Asia\/Shanghai）/)).toBeInTheDocument();
    expect(screen.getByText(/2026\/07\/29 00:00:00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "审核用户举报" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });

  // OpenIM 同步 outbox 已拆除:不再渲染假队列,待处理事项只数治理队列。
  it("counts only moderation work and renders no retired outbox queue", async () => {
    renderPage();

    const headline = (await screen.findByText("待处理事项")).closest(
      ".ant-statistic",
    );
    expect(headline).not.toBeNull();
    expect(within(headline as HTMLElement).getByText("21")).toBeInTheDocument();
    expect(screen.getByText("服务健康")).toBeInTheDocument();
    expect(screen.queryByText("OpenIM")).not.toBeInTheDocument();
    expect(screen.queryByText("Outbox 状态")).not.toBeInTheDocument();
    expect(screen.queryByText(/^待处理 \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^处理中 \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^失败 \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/最老待处理/)).not.toBeInTheDocument();
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

    expect(await screen.findByText("Dashboard 加载失败")).toBeInTheDocument();
    expect(screen.getByText("系统状态尚未获取")).toBeInTheDocument();
    expect(screen.queryByText("接口服务 异常")).not.toBeInTheDocument();
    expect(screen.queryByText("数据库异常")).not.toBeInTheDocument();
    expect(screen.queryByText("缓存服务 异常")).not.toBeInTheDocument();
    expect(screen.getByText("用户数据尚未获取")).toBeInTheDocument();
    expect(screen.getByText("社区数据尚未获取")).toBeInTheDocument();
    expect(screen.getByText("商城数据尚未获取")).toBeInTheDocument();
    expect(screen.getByText("举报处理数据尚未获取")).toBeInTheDocument();
    expect(screen.queryByText("圈子总数")).not.toBeInTheDocument();
    expect(screen.queryByText("有效会员")).not.toBeInTheDocument();
    expect(screen.queryByText("待处理总计")).not.toBeInTheDocument();
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

    for (const title of ["用户总数", "使用人数", "积分消费", "待处理事项"]) {
      const card = (await screen.findByText(title)).closest(".ant-statistic");
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByText("--")).toBeInTheDocument();
    }
  });

  it("keeps the banned-user count unknown when only user metrics fail", async () => {
    mockedGetDashboard.mockResolvedValue({
      ...dashboard,
      sections: {
        ...dashboard.sections,
        users: { status: "error", data: null },
      },
    });

    renderPage();

    const label = await screen.findByText("封禁用户");
    const row = label.closest(".ant-descriptions-item");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("--")).toBeInTheDocument();
  });
});

it("combines overview and growth with on-demand queries and preserves analysis time ranges", async () => {
  renderPage();
  await screen.findByText("12,580");
  expect(consoleApi.analytics).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "用户使用情况" }));
  expect(await screen.findByText("注册后还有多少人回来使用")).toBeInTheDocument();
  expect(consoleApi.analytics).toHaveBeenCalledWith(30);
  expect(screen.getByRole("heading", { name: "数据看板" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "运营概览" }));
  expect(await screen.findByText("12,580")).toBeInTheDocument();
  expect(screen.queryByText("注册后还有多少人回来使用")).not.toBeInTheDocument();
});
it("redirects old insights links into the dashboard growth tab without losing the selected range", async () => {
  renderPage("/insights?days=90");
  expect(await screen.findByText("注册后还有多少人回来使用")).toBeInTheDocument();
  expect(consoleApi.analytics).toHaveBeenCalledWith(90);
  expect(mockedGetDashboard).not.toHaveBeenCalled();
  expect(screen.getByRole("tab", { name: "用户使用情况" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

it("explains statistics without funnel or retention jargon",async()=>{
 renderPage("/?tab=growth");
 expect(await screen.findByText("新用户注册后，有多少人开始聊天")).toBeInTheDocument();
 expect(screen.getByText("注册后还有多少人回来使用")).toBeInTheDocument();
 expect(screen.getByText("回来使用的比例")).toBeInTheDocument();
 expect(screen.queryByText(/漏斗|留存|转化窗口/)).not.toBeInTheDocument();
});
