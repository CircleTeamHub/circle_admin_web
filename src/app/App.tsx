import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ConfigProvider, Spin } from "antd";
import zhCN from "antd/locale/zh_CN";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getMe } from "../api/auth";
import { AppLayout } from "../components/AppLayout";
import { RequireAdmin } from "../auth/RequireAdmin";
import { clearSession, getSession } from "../auth/session";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SystemStatusPage } from "../pages/SystemStatusPage";
import { UsersPage } from "../pages/UsersPage";
import { UserDetailPage } from "../pages/UserDetailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AdminRoutes() {
  const session = getSession();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: !!session,
    retry: 0,
  });

  if (session && me.isLoading) {
    return <Spin fullscreen />;
  }

  if (session && me.isError) {
    clearSession();
    return <Navigate to="/login" replace />;
  }

  return (
    <RequireAdmin user={me.data || null}>
      {me.data ? (
        <Routes>
          <Route element={<AppLayout user={me.data} />}>
            <Route index element={<DashboardPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route
              path="users/:userId"
              element={<UserDetailPage currentUser={me.data} />}
            />
            <Route path="system" element={<SystemStatusPage />} />
          </Route>
        </Routes>
      ) : null}
    </RequireAdmin>
  );
}

export function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AdminRoutes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
