import { PageHeader } from "../components/PageHeader";
import { Result, Space, Tabs, Typography } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminAccess } from "../auth/admin-access";
import { InvitesPage } from "./InvitesPage";
import { MembershipsPage } from "./MembershipsPage";
import { SupportRechargePage } from "./SupportRechargePage";

export function VipRechargePage() {
  const { hasPermission } = useAdminAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const items = [
    ...(hasPermission("COMMERCE_MANAGE") ? [{ key: "/memberships", label: "VIP管理", children: <MembershipsPage embedded /> }] : []),
    ...(hasPermission("RECHARGE_MANAGE") ? [{ key: "/recharge", label: "充值管理", children: <SupportRechargePage embedded /> }] : []),
    ...(hasPermission("CONTENT_MANAGE") ? [{ key: "/invites", label: "邀请奖励", children: <InvitesPage embedded /> }] : []),
  ];
  if (!items.length) return <Result status="403" title="当前管理员无此功能权限" subTitle="请联系超级管理员分配对应角色。" />;
  const activeKey = items.some((item) => item.key === location.pathname) ? location.pathname : items[0].key;
  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <PageHeader title="VIP和充值管理" description="管理会员权益、核对充值申请与查看邀请奖励。" />
      <Tabs activeKey={activeKey} onChange={(key) => navigate(key)} destroyOnHidden items={items} />
    </Space>
  );
}
