import { Identifier, CodeValue } from "../components/ReadableValue";
import { useQuery } from "@tanstack/react-query";
import { Card, Space, Table, Typography } from "antd";
import { Link } from "react-router-dom";
import { consoleApi } from "../api/console";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";
import { useAdminAccess } from "../auth/admin-access";
import { CollectionNotice, Pager, useConsoleFilters } from "./console-shared";
export function UserTimelineCard({ userID }: { userID: string }) {
  const { search } = useConsoleFilters(),
    { hasPermission } = useAdminAccess();
  const query = useQuery({
    queryKey: ["console", "timeline", userID, search.toString()],
    queryFn: () => consoleApi.timeline(userID, search),
  });
  return (
    <Card title="用户行为、设备与会话">
      <Space orientation="vertical" style={{ width: "100%" }}>
        {hasPermission("SUPPORT_MANAGE") && (
          <Link to={`/push-operations?userID=${encodeURIComponent(userID)}`}>
            查看该用户推送投递
          </Link>
        )}
        <CollectionNotice startedAt={query.data?.collectionStartedAt} />
        {query.isError && (
          <PageError error={query.error} onRetry={() => void query.refetch()} />
        )}
        <Table
          rowKey="id"
          dataSource={query.data?.items}
          loading={query.isFetching}
          pagination={false}
          columns={[
            { title: "时间", dataIndex: "createdAt", render: formatDateTime },
            {
              title: "行为",
              dataIndex: "name",
              render: (s: string) => <CodeValue domain="event" value={s} />,
            },
            {
              title: "来源",
              dataIndex: "source",
              render: (value: string | null) => (
                <CodeValue domain="source" value={value} />
              ),
            },
            {
              title: "对象类型",
              dataIndex: "entityType",
              render: (value: string | null) => (
                <CodeValue domain="entity" value={value} />
              ),
            },
            {
              title: "对象 ID",
              dataIndex: "entityID",
              render: (value: string | null) => <Identifier value={value} />,
            },
            {
              title: "平台",
              dataIndex: "platform",
              render: (value: string | null) => (
                <CodeValue domain="platform" value={value} />
              ),
            },
          ]}
        />
        <Pager nextCursor={query.data?.nextCursor} />
        <Typography.Text type="secondary">
          不展示聊天或笔记正文。以下为最近 20
          条会话和设备登记；首个分页显示设备概况。
        </Typography.Text>
        <Table
          rowKey="id"
          dataSource={query.data?.sessions}
          pagination={false}
          columns={[
            {
              title: "登录会话建立",
              dataIndex: "createdAt",
              render: formatDateTime,
            },
            {
              title: "客户端",
              dataIndex: "audience",
              render: (value: string | null) => (
                <CodeValue domain="audience" value={value} />
              ),
            },
            { title: "设备名", dataIndex: "deviceName" },
            {
              title: "状态",
              render: (_, r) =>
                r.revokedAt
                  ? "已撤销"
                  : new Date(r.expiredAt) <= new Date()
                    ? "已过期"
                    : "有效",
            },
          ]}
        />
        <Typography.Text strong>受信任设备</Typography.Text>
        <Table
          rowKey="id"
          dataSource={query.data?.devices}
          pagination={false}
          columns={[
            {
              title: "设备登记 ID",
              dataIndex: "id",
              render: (value: string) => <Identifier value={value} />,
            },
            { title: "设备名称", dataIndex: "deviceName" },
            {
              title: "最近活动",
              dataIndex: "lastSeenAt",
              render: formatDateTime,
            },
            {
              title: "状态",
              dataIndex: "revokedAt",
              render: (v: string | null) => (v ? "已撤销" : "受信任"),
            },
          ]}
        />
        <Table
          rowKey="id"
          dataSource={query.data?.installations}
          pagination={false}
          columns={[
            {
              title: "平台",
              dataIndex: "platform",
              render: (value: string | null) => (
                <CodeValue domain="platform" value={value} />
              ),
            },
            { title: "版本", dataIndex: "appVersion" },
            { title: "构建号", dataIndex: "build" },
            {
              title: "更新预览",
              render: (_, r) =>
                hasPermission("CONTENT_MANAGE") &&
                ["android", "ios"].includes(r.platform) ? (
                  <Link
                    to={`/releases?tab=preview&installationID=${encodeURIComponent(r.id)}&platform=${encodeURIComponent(r.platform)}&channel=${encodeURIComponent(r.channel)}&build=${r.build}`}
                  >
                    预览这台设备
                  </Link>
                ) : (
                  "—"
                ),
            },
            {
              title: "最近活跃",
              dataIndex: "lastSeenAt",
              render: formatDateTime,
            },
          ]}
        />
      </Space>
    </Card>
  );
}
