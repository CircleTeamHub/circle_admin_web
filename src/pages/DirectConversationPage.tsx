import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Card, Collapse, Descriptions, Space, Spin, Tabs, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listImConversations } from "../api/admin-im";
import { ApiError } from "../api/client";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { Identifier } from "../components/ReadableValue";
import { formatDateTime } from "../utils/format";
import { conversationTitle } from "./im-presentation";
import { ConversationHistory } from "./ImPage";

export function DirectConversationPage() {
  const { conversationId = "" } = useParams();
  const { hasPermission } = useAdminAccess();
  const [tab, setTab] = useState("profile");
  const query = useQuery({
    queryKey: ["direct-conversation-detail", conversationId],
    queryFn: async () => {
      const result = await listImConversations(conversationId, "DIRECT", 1);
      const conversation = result.items.find((item) => item.id === conversationId && item.type === "DIRECT");
      if (!conversation) throw new ApiError("私聊会话不存在或已不可用", 404);
      return conversation;
    },
    enabled: !!conversationId,
  });
  const back = <Link to="/im?type=DIRECT">返回私聊列表</Link>;
  if (query.isError) return <Space orientation="vertical">{back}<PageError error={query.error} onRetry={() => void query.refetch()} /></Space>;
  if (query.isPending) return <Spin aria-label="正在加载私聊详情" />;
  const conversation = query.data;
  return (
    <Space orientation="vertical" size={16} className="page-stack">
      {back}
      <Space>
        <Avatar size={56} icon={<UserOutlined />} />
        <Typography.Title level={3} style={{ margin: 0 }}>{conversationTitle(conversation)}</Typography.Title>
        <Button onClick={() => void query.refetch()} loading={query.isFetching}>刷新资料</Button>
      </Space>
      <Tabs activeKey={tab} onChange={setTab} destroyOnHidden items={[
        {
          key: "profile", label: "私聊详情", children: (
            <Space orientation="vertical" size={16} className="page-stack">
              <Card title="会话资料">
                <Descriptions bordered column={{ xs: 1, md: 2 }} items={[
                  { key: "type", label: "会话类型", children: "私聊" },
                  { key: "count", label: "当前参与人数", children: `${conversation.memberCount} 人` },
                  { key: "last", label: "最近消息时间", children: conversation.lastMessageAt ? formatDateTime(conversation.lastMessageAt) : "未记录" },
                ]} />
              </Card>
              <Card title="参与人">
                <Space orientation="vertical" size={16}>
                  {conversation.participants.length ? conversation.participants.map((person) => (
                    <Space key={person.id} size={12}>
                      <Avatar icon={<UserOutlined />} />
                      {hasPermission("USER_READ") ? (
                        <Link to={`/users/${encodeURIComponent(person.id)}`}>{person.nickname || "未命名用户"}</Link>
                      ) : <Typography.Text>{person.nickname || "未命名用户"}</Typography.Text>}
                    </Space>
                  )) : <Typography.Text type="secondary">暂无当前成员</Typography.Text>}
                </Space>
              </Card>
              <Collapse items={[{ key: "id", label: "内部编号（排查使用）", children: <Identifier value={conversation.id} inline /> }]} />
            </Space>
          ),
        },
        { key: "history", label: "聊天记录", children: <ConversationHistory key={conversation.id} conversation={conversation} onClose={() => setTab("profile")} /> },
      ]} />
    </Space>
  );
}
