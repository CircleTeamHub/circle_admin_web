import { Space, Tag, Typography } from "antd";
import type { AdminUser } from "../types";

export function UserSummary({ user }: { user?: AdminUser | null }) {
  if (!user) return <Typography.Text type="secondary">-</Typography.Text>;

  return (
    <Space direction="vertical" size={0}>
      <Space size={6}>
        <Typography.Text strong>{user.accountId}</Typography.Text>
        {user.status ? <Tag>{user.status}</Tag> : null}
      </Space>
      <Typography.Text type="secondary">{user.nickname || "未设置昵称"}</Typography.Text>
    </Space>
  );
}
