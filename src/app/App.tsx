import { UserContentDetailPage } from "../pages/UserContentDetailPage";
import { GroupDetailPage } from "../pages/GroupDetailPage";
import { CircleDetailPage } from "../pages/CircleDetailPage";
import { PushOperationsPage } from "../pages/PushOperationsPage";
import { TasksPage } from "../pages/TasksPage";
import { ReleasesPage } from "../pages/ReleasesPage";
import { DiagnosticsPage, UserEventsPage } from "../pages/DiagnosticsPage";
import { ApiKeysPage } from "../pages/ApiKeysPage";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { Button, ConfigProvider, Modal, Result, Spin } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getMe } from "../api/auth";
import { AppLayout } from "../components/AppLayout";
import { RequireAdmin } from "../auth/RequireAdmin";
import {
  clearSession,
  getSession,
  getSessionEpoch,
  subscribeSession,
  type SessionTokens,
} from "../auth/session";
import { DashboardPage, LegacyInsightsRedirect } from "../pages/DashboardPage";
import { CommunityPage } from "../pages/CommunityPage";
import { SupportAgentsPage } from "../pages/SupportAgentsPage";
import { LoginPage } from "../pages/LoginPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SystemStatusPage } from "../pages/SystemStatusPage";
import { UsersPage } from "../pages/UsersPage";
import { UserDetailPage } from "../pages/UserDetailPage";
import { ApiError, apiClient } from "../api/client";
import {
  AdminAccessContext,
  RequirePermission,
  type AdminAccess,
} from "../auth/admin-access";
import { MembershipsPage } from "../pages/MembershipsPage";
import { SupportRechargePage } from "../pages/SupportRechargePage";
import { ContentPage } from "../pages/ContentPage";
import { SensitiveWordsPage } from "../pages/SensitiveWordsPage";
import { AnnouncementsPage } from "../pages/AnnouncementsPage";
import { ImPage } from "../pages/ImPage";
import { GroupMembersPage } from "../pages/GroupMembersPage";
import { AuditLogsPage } from "../pages/AuditLogsPage";
import { InvitesPage } from "../pages/InvitesPage";
import { AdminAccessPage } from "../pages/AdminAccessPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AdminRoutes({
  session,
  sessionEpoch,
}: {
  session: SessionTokens | null;
  sessionEpoch: number;
}) {
  const currentPermissions = useRef("");
  const me = useQuery({
    queryKey: ["me", sessionEpoch],
    queryFn: getMe,
    enabled: !!session,
    retry: 0,
  });
  const access = useQuery({
    queryKey: ["admin-access-me", sessionEpoch],
    queryFn: () => apiClient<AdminAccess>("/admin/access/me"),
    enabled:
      !!session && me.data?.role === "ADMIN" && me.data.status === "ACTIVE",
    retry: 0,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (!access.data) return;
    const signature = `${access.data.role}:${access.data.permissions.join(",")}`;
    if (currentPermissions.current && currentPermissions.current !== signature)
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] !== "me" && query.queryKey[0] !== "admin-access-me",
      });
    currentPermissions.current = signature;
  }, [access.data]);
  useEffect(() => {
    if (session && me.error instanceof ApiError && me.error.status === 401)
      clearSession();
  }, [session, me.isError]);

  if (session && me.isLoading) {
    return <Spin fullscreen />;
  }

  if (session && me.isError) {
    return (
      <Result
        status="500"
        title="暂时无法连接后台"
        subTitle="登录状态已保留，请确认后端服务正常后重试。"
        extra={<Button onClick={() => void me.refetch()}>重试</Button>}
      />
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }


  if (
    me.data?.role === "ADMIN" &&
    me.data.status === "ACTIVE" &&
    access.isPending
  )
    return <Spin fullscreen />;
  if (
    me.data?.role === "ADMIN" &&
    me.data.status === "ACTIVE" &&
    access.isError
  )
    return (
      <Result
        status="403"
        title="无法读取管理员权限"
        subTitle={
          access.error instanceof ApiError && access.error.status === 403
            ? "当前账号没有分配管理员权限，请联系超级管理员。"
            : "权限服务暂时不可用，请确认后端运行正常后重试；登录状态已保留。"
        }
        extra={<Button onClick={() => access.refetch()}>重试</Button>}
      />
    );

  return (
    <RequireAdmin user={me.data || null}>
      {me.data ? (
        <AdminAccessContext.Provider value={access.data ?? null}>
          <Routes>
            <Route element={<AppLayout user={me.data} />}>
              <Route
                path="push-operations"
                element={
                  <RequirePermission permission="SUPPORT_MANAGE">
                    <PushOperationsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="tasks"
                element={
                  <RequirePermission permission="DASHBOARD">
                    <TasksPage />
                  </RequirePermission>
                }
              />
              <Route
                path="insights"
                element={
                  <RequirePermission permission="DASHBOARD">
                    <LegacyInsightsRedirect />
                  </RequirePermission>
                }
              />
              <Route
                path="releases"
                element={
                  <RequirePermission permission="CONTENT_MANAGE">
                    <ReleasesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="user-events"
                element={
                  <RequirePermission permission="AUDIT_READ">
                    <UserEventsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="diagnostics"
                element={
                  <RequirePermission permission="AUDIT_READ">
                    <DiagnosticsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="automation-keys"
                element={
                  <RequirePermission permission="ACCESS_MANAGE">
                    <ApiKeysPage />
                  </RequirePermission>
                }
              />

              <Route
                index
                element={
                  access.data?.permissions.includes("DASHBOARD") ? (
                    <DashboardPage />
                  ) : (
                    <Navigate to="/users" replace />
                  )
                }
              />
              <Route
                path="reports"
                element={
                  <RequirePermission permission="MODERATION_MANAGE">
                    <ReportsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="community/circles/:circleId"
                element={
                  <RequirePermission permission="COMMUNITY_MANAGE">
                    <CircleDetailPage />
                  </RequirePermission>
                }
              />
              <Route
                path="community/groups/:conversationId"
                element={
                  <RequirePermission permission="COMMUNITY_MANAGE">
                    <GroupDetailPage />
                  </RequirePermission>
                }
              />
              <Route
                path="community"
                element={
                  <RequirePermission permission="COMMUNITY_MANAGE">
                    <CommunityPage />
                  </RequirePermission>
                }
              />
              <Route
                path="support-agents"
                element={
                  <RequirePermission permission="SUPPORT_MANAGE">
                    <SupportAgentsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="users"
                element={
                  <RequirePermission permission="USER_READ">
                    <UsersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="users/:userId/posts/:resourceId"
                element={
                  <RequirePermission permission="MODERATION_MANAGE">
                    <UserContentDetailPage kind="posts" />
                  </RequirePermission>
                }
              />
              <Route
                path="users/:userId/notes/:resourceId"
                element={
                  <RequirePermission permission="MODERATION_MANAGE">
                    <UserContentDetailPage kind="notes" />
                  </RequirePermission>
                }
              />
              <Route
                path="users/:userId"
                element={
                  <RequirePermission permission="USER_READ">
                    <UserDetailPage currentUser={me.data} />
                  </RequirePermission>
                }
              />
              <Route
                path="system"
                element={
                  <RequirePermission permission="DASHBOARD">
                    <SystemStatusPage />
                  </RequirePermission>
                }
              />
              <Route
                path="memberships"
                element={
                  <RequirePermission permission="COMMERCE_MANAGE">
                    <MembershipsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="recharge"
                element={
                  <RequirePermission permission="RECHARGE_MANAGE">
                    <SupportRechargePage />
                  </RequirePermission>
                }
              />
              <Route
                path="support-recharge"
                element={
                  <RequirePermission permission="RECHARGE_MANAGE">
                    <Navigate to="/recharge" replace />
                  </RequirePermission>
                }
              />
              <Route
                path="content"
                element={
                  <RequirePermission permission="MODERATION_MANAGE">
                    <ContentPage />
                  </RequirePermission>
                }
              />
              <Route
                path="sensitive-words"
                element={
                  <RequirePermission permission="CONTENT_MANAGE">
                    <SensitiveWordsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="announcements"
                element={
                  <RequirePermission permission="CONTENT_MANAGE">
                    <AnnouncementsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="im"
                element={
                  <RequirePermission permission="IM_READ">
                    <ImPage />
                  </RequirePermission>
                }
              />
              <Route
                path="im/conversations/:conversationId/members"
                element={
                  <RequirePermission permission="IM_MODERATE">
                    <GroupMembersPage />
                  </RequirePermission>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <RequirePermission permission="AUDIT_READ">
                    <AuditLogsPage />
                  </RequirePermission>
                }
              />
              <Route
                path="invites"
                element={
                  <RequirePermission permission="CONTENT_MANAGE">
                    <InvitesPage />
                  </RequirePermission>
                }
              />
              <Route
                path="admin-access"
                element={
                  <RequirePermission permission="ACCESS_MANAGE">
                    <AdminAccessPage />
                  </RequirePermission>
                }
              />
              <Route
                path="*"
                element={<Result status="404" title="页面不存在" />}
              />
            </Route>
          </Routes>
        </AdminAccessContext.Provider>
      ) : null}
    </RequireAdmin>
  );
}

export function App() {
  const [sessionState, setSessionState] = useState(() => ({
    session: getSession(),
    epoch: getSessionEpoch(),
  }));
  const currentEpoch = useRef(sessionState.epoch);
  useEffect(() => {
    const updateSession = () => {
      const epoch = getSessionEpoch();
      if (epoch !== currentEpoch.current) {
        queryClient.clear();
        Modal.destroyAll();
        currentEpoch.current = epoch;
      }
      setSessionState({ session: getSession(), epoch });
    };
    const unsubscribe = subscribeSession(updateSession);
    updateSession();
    return unsubscribe;
  }, []);
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <AdminRoutes
                  key={sessionState.epoch}
                  session={sessionState.session}
                  sessionEpoch={sessionState.epoch}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
