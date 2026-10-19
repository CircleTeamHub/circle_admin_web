import { AdminNicknameEditor } from "./AdminNicknameEditor";
import { useEffect } from "react";
import {
  DashboardOutlined,
  CommentOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Button, Layout, Menu, Space, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";
import type { AuthUser } from "../types";
import { useAdminAccess } from "../auth/admin-access";
import { ADMIN_NAVIGATION } from "../auth/admin-navigation";

const { Header, Sider, Content } = Layout;

export function AppLayout({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);
  const { access, hasPermission } = useAdminAccess();

  const selectedKey = ["/recharge", "/support-recharge", "/invites"].includes(location.pathname)
              ? "/memberships"
              : location.pathname.startsWith("/community/groups/") && hasPermission("IM_READ")
              ? "/im"
              : ADMIN_NAVIGATION.find(
              (item) =>
                item.key !== "/" &&
                (location.pathname === item.key ||
                  location.pathname.startsWith(`${item.key}/`)),
            )?.key ?? "/";
  const currentSection = ADMIN_NAVIGATION.find((item) => item.key === selectedKey)?.label ?? "后台管理";
  const navigationItems = ADMIN_NAVIGATION.filter((item) =>
            hasPermission(item.permission) || Boolean(item.additionalPermissions?.some(hasPermission)),
          ).map((item) => ({
            ...item,
            icon:
              item.key === "/" ? (
                <DashboardOutlined />
              ) : item.key === "/users" ? (
                <TeamOutlined />
              ) : item.key === "/im" || item.key === "/community" ? (
                <CommentOutlined />
              ) : item.key === "/memberships" ? (
                <StarOutlined />
              ) : item.key.includes("support") || item.key === "/recharge" ? (
                <CustomerServiceOutlined />
              ) : item.key === "/system" || item.key === "/audit-logs" ? (
                <ToolOutlined />
              ) : (
                <SafetyCertificateOutlined />
              ),
          }));
  const navigationGroups = [
    { label: "概览", keys: ["/"] },
    { label: "用户与社群", keys: ["/users", "/community", "/im", "/content", "/reports", "/sensitive-words"] },
    { label: "运营管理", keys: ["/memberships", "/support-agents", "/announcements", "/push-operations"] },
    { label: "系统与排查", keys: ["/admin-access", "/audit-logs", "/tasks", "/releases", "/diagnostics", "/user-events", "/automation-keys", "/system"] },
  ];

  return (
    <Layout className="app-shell">
      <a className="skip-to-content" href="#main-content">跳到页面内容</a>
      <Sider
        breakpoint="lg"
        collapsedWidth={64}
        width={232}
        theme="light"
        className="app-sider"
      >
        <div className="brand"><span>Circle Admin</span><small>运营管理后台</small></div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={navigationGroups.map((group) => ({
            type: "group" as const,
            key: group.label,
            label: group.label,
            children: navigationItems.filter((item) => group.keys.includes(item.key)),
          })).filter((group) => group.children.length > 0)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Breadcrumb className="app-breadcrumb" items={[{ title: "后台管理" }, { title: currentSection }]} />
          <Space>
            <Tag>
              {(
                {
                  SUPER_ADMIN: "超级管理员",
                  OPERATIONS: "运营",
                  MODERATOR: "审核",
                  SUPPORT: "客服",
                } as Record<string, string>
              )[access?.role ?? ""] ?? "未分配权限"}
            </Tag>
            <Typography.Text title={`账号：${user.accountId}`}>
              {user.nickname || user.accountId}
            </Typography.Text>
            <AdminNicknameEditor user={user} />
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                clearSession();
                navigate("/login", { replace: true });
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="app-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
