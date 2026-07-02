import {
  DashboardOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, Space, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";
import type { AuthUser } from "../types";

const { Header, Sider, Content } = Layout;

export function AppLayout({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const env = import.meta.env.VITE_APP_ENV || "development";

  return (
    <Layout className="app-shell">
      <Sider width={216} theme="light" className="app-sider">
        <div className="brand">Circle Admin</div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
            { key: "/reports", icon: <SafetyCertificateOutlined />, label: "举报审核" },
            { key: "/users", icon: <TeamOutlined />, label: "用户管理" },
            { key: "/system", icon: <ToolOutlined />, label: "系统状态" },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space>
            <Tag color={env === "production" ? "red" : "blue"}>{env}</Tag>
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
