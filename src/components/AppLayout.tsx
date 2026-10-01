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
import { Button, Layout, Menu, Space, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";
import type { AuthUser } from "../types";
import { useAdminAccess } from "../auth/admin-access";
import { ADMIN_NAVIGATION } from "../auth/admin-navigation";

const { Header, Sider, Content } = Layout;

export function AppLayout({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const env = import.meta.env.VITE_APP_ENV || "development";
  const { access, hasPermission } = useAdminAccess();

  return (
    <Layout className="app-shell">
      <Sider width={216} theme="light" className="app-sider">
        <div className="brand">Circle Admin</div>
        <Menu
          mode="inline"
          selectedKeys={[
            ADMIN_NAVIGATION.find(
              (item) =>
                item.key !== "/" &&
                (location.pathname === item.key ||
                  location.pathname.startsWith(`${item.key}/`)),
            )?.key ?? "/",
          ]}
          onClick={({ key }) => navigate(key)}
          items={ADMIN_NAVIGATION.filter((item) =>
            hasPermission(item.permission),
          ).map((item) => ({
            ...item,
            icon:
              item.key === "/" ? (
                <DashboardOutlined />
              ) : item.key === "/users" ? (
                <TeamOutlined />
              ) : item.key === "/im" || item.key === "/community" ? (
                <CommentOutlined />
              ) : item.key.includes("fancy") || item.key === "/memberships" ? (
                <StarOutlined />
              ) : item.key.includes("support") || item.key === "/recharge" ? (
                <CustomerServiceOutlined />
              ) : item.key === "/system" || item.key === "/audit-logs" ? (
                <ToolOutlined />
              ) : (
                <SafetyCertificateOutlined />
              ),
          }))}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space>
            <Tag color={env === "production" ? "red" : "blue"}>{env}</Tag>
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
            <Typography.Text>{user.nickname || user.accountId}</Typography.Text>
            <Typography.Text type="secondary">{user.accountId}</Typography.Text>
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
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
