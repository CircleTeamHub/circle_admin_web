import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserDetail, listUserAuditLogs } from "../api/users";
import { ApiError } from "../api/client";
import { AdminAccessContext, type AdminPermission } from "../auth/admin-access";
import type { AdminUserDetail, AuthUser } from "../types";
import { UserDetailPage } from "./UserDetailPage";

vi.mock("../api/users", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/users")>();
  return {
    ...original,
    getUserDetail: vi.fn(),
    listUserAuditLogs: vi.fn(),
  };
});

vi.mock("../components/UserAvatarFramesCard", () => ({
  UserAvatarFramesCard: () => <div>avatar-frame-actions</div>,
}));

const mockedDetail = vi.mocked(getUserDetail);
const mockedAudit = vi.mocked(listUserAuditLogs);
const admin: AuthUser = {
  id: "admin-1",
  userId: "admin-1",
  accountId: "support-admin",
  role: "ADMIN",
  status: "ACTIVE",
};
const detail: AdminUserDetail = {
  profile: {
    id: "u1",
    accountId: "jim-1001",
    nickname: "Jim",
    avatarUrl: null,
    role: "USER",
    status: "ACTIVE",
    city: "Shanghai",
    region: "CN",
    gender: "unset",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    lastOnline: null,
  },
  maskedContacts: {
    email: "j***@example.com",
    phoneNumber: "*******5678",
    wechat: "j***y",
    qq: "1***5",
    whatsup: null,
  },
  security: {
    securityCodeLocked: false,
    singleDeviceLoginEnabled: true,
    activeSessionCount: 2,
    activePushDeviceCount: 3,
  },
  summary: {
    creditScore: 88,
    walletBalance: 120,
    friendCount: 4,
    noteCount: 5,
    traceCount: 6,
    circlesOwnedCount: 7,
    circleMembershipCount: 8,
    reportsFiledCount: 9,
    reportsReceivedCount: 10,
  },
};

function renderPage(permissions: AdminPermission[] = ["USER_READ", "AUDIT_READ"]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminAccessContext.Provider
        value={{ role: "SUPPORT", permissions, version: 1 }}
      >
        <MemoryRouter initialEntries={["/users/u1"]}>
          <Routes>
            <Route
              path="/users/:userId"
              element={<UserDetailPage currentUser={admin} />}
            />
          </Routes>
        </MemoryRouter>
      </AdminAccessContext.Provider>
    </QueryClientProvider>,
  );
}

describe("UserDetailPage", () => {
  beforeEach(() => {
    mockedDetail.mockReset();
    mockedAudit.mockReset();
    mockedDetail.mockResolvedValue(detail);
    mockedAudit.mockResolvedValue([
      {
        id: "audit-1",
        actorId: "admin-1",
        actorAccountId: "support-admin",
        action: "USER_SENSITIVE_FIELD_VIEWED",
        targetType: "user",
        targetId: "u1",
        before: null,
        after: null,
        reason: "CS-1024",
        metadata: { field: "email" },
        requestId: "req-1",
        ip: "127.0.0.1",
        userAgent: "vitest",
        createdAt: "2026-07-22T00:00:00.000Z",
      },
    ]);
  });

  it(
    "renders the user profile and authorized audit history",
    async () => {
      renderPage();

      expect((await screen.findAllByText("jim-1001")).length).toBeGreaterThan(0);
      expect(screen.getByText("账户资料")).toBeInTheDocument();
      expect(screen.getByText("联系信息")).toBeInTheDocument();
      expect(screen.getByText("安全与同步")).toBeInTheDocument();
      expect(screen.getByText("业务概览")).toBeInTheDocument();
      expect(screen.getByText("88")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
      expect(screen.getByText("j***@example.com")).toBeInTheDocument();
      expect(
        await screen.findByText("USER_SENSITIVE_FIELD_VIEWED"),
      ).toBeInTheDocument();
      expect(screen.getByText("会员操作需要运营权限。")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /VIP|升级|开通/ }),
      ).not.toBeInTheDocument();
      expect(mockedAudit).toHaveBeenCalledWith("u1", 20);
      expect(screen.getByRole("link", { name: "返回用户列表" })).toHaveAttribute(
        "href",
        "/users",
      );
    },
  );

  it("keeps restricted actions and audit requests unavailable for read-only access", async () => {
    renderPage(["USER_READ"]);

    expect(await screen.findByText("j***@example.com")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "查看原文" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("危险操作")).not.toBeInTheDocument();
    expect(screen.queryByText("最近 Admin 操作")).not.toBeInTheDocument();
    expect(screen.queryByText("avatar-frame-actions")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "查看会员等级、有效期及发放记录" }),
    ).not.toBeInTheDocument();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("links authorized commerce administrators to the user's memberships", async () => {
    renderPage(["USER_READ", "COMMERCE_MANAGE"]);

    expect(
      await screen.findByRole("link", { name: "查看会员等级、有效期及发放记录" }),
    ).toHaveAttribute("href", "/memberships?search=jim-1001");
    expect(screen.getByText("avatar-frame-actions")).toBeInTheDocument();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("shows a loading state while detail is pending", () => {
    mockedDetail.mockReturnValue(new Promise(() => {}));
    mockedAudit.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText("正在加载用户详情…")).toBeInTheDocument();
  });

  it("shows an error state and keeps the backlink", async () => {
    mockedDetail.mockRejectedValue(new ApiError("User not found", 404));

    renderPage();

    expect(await screen.findByText("用户详情加载失败")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回用户列表" })).toBeInTheDocument();
  });

  it("falls back to the account id when the nickname is blank", async () => {
    mockedDetail.mockResolvedValue({
      ...detail,
      profile: { ...detail.profile, nickname: "" },
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "jim-1001" })).toBeInTheDocument();
    expect(screen.getByText("J")).toBeInTheDocument();
  });
});
