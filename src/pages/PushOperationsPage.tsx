import { ReloadOutlined } from "@ant-design/icons";
import { Identifier, CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import {
  notificationLabel,
  nextTaskAttempt,
  taskResult,
} from "./task-presentation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import { consoleApi, type Push } from "../api/console";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";
import {
  Pager,
  ReasonAction,
  STATUS,
  useConsoleFilters,
} from "./console-shared";

export function PushOperationsPage() {
  const { search, set } = useConsoleFilters(),
    { hasPermission } = useAdminAccess();
  const rows = useQuery({
    queryKey: ["console", "push", search.toString()],
    queryFn: () => consoleApi.pushes(search),
    refetchInterval: 15000,
  });
  const userID = search.get("userID");
  const taskID = search.get("taskID");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(taskID ? [taskID] : []);
  useEffect(() => setExpandedKeys(taskID ? [taskID] : []), [taskID]);
  const clearFilters = () => set({ userID: undefined, deviceID: undefined, taskID: undefined, status: undefined, cursor: undefined });
  const hasFilters = Boolean(userID || taskID || search.get("deviceID") || search.get("status") || search.get("cursor"));
  const statusColor = (status: string) => ({ PENDING: "gold", PROCESSING: "blue", COMPLETED: "green", FAILED: "red", TERMINAL: "default", SENT: "cyan", CONFIRMED: "green" }[status] ?? "default");
  const devices = useQuery({
    queryKey: ["console", "push-devices", userID],
    queryFn: () => consoleApi.devices(userID!),
    enabled: !!userID,
  });
  const columns = [
    {
      title: "通知", width: 210,
      render: (_: unknown, row: Push) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text strong>{notificationLabel(row.notification.type)}</Typography.Text>
          <Typography.Text type="secondary">{formatDateTime(row.createdAt)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "收件人", width: 170,
      render: (_: unknown, row: Push) => row.notification.toUserID ? (
        hasPermission("USER_READ") ? (
          <Link to={`/users/${encodeURIComponent(row.notification.toUserID)}`}>
            {row.notification.toUser?.nickname || "查看用户"}
          </Link>
        ) : <Typography.Text>{row.notification.toUser?.nickname || "通知收件人"}</Typography.Text>
      ) : "—",
    },
    { title: "状态", width: 100, dataIndex: "status", render: (status: string) => <Tag color={statusColor(status)}>{STATUS[status] ?? "未知状态"}</Tag> },
    { title: "处理结果", width: 280, render: (_: unknown, row: Push) => taskResult(row) },
    {
      title: "操作", width: 190,
      render: (_: unknown, row: Push) => (
        <Space wrap size={[8, 8]}>
          <Button type="link" onClick={() => setExpandedKeys((keys) => keys.includes(row.id) ? keys.filter((key) => key !== row.id) : [...keys, row.id])}>
            {expandedKeys.includes(row.id) ? "收起详情" : "查看投递详情"}
          </Button>
          {row.status === "FAILED" && <ReasonAction title="重试失败设备" path={`/admin/console/push/${row.id}/retry`} payload={{ version: row.updatedAt }} />}
        </Space>
      ),
    },
  ];
  return (
    <Space orientation="vertical" className="page-stack push-operations" size={20}>
      <div className="push-page-heading">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>通知管理</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>查看通知发给了谁、发送是否成功，以及失败原因。</Typography.Paragraph>
        </div>
        <Typography.Text type="secondary">每 15 秒自动刷新</Typography.Text>
      </div>
      {rows.isError && <PageError error={rows.error} onRetry={() => void rows.refetch()} message="发送记录加载失败" />}
      <Card title={taskID ? "发送详情" : "发送记录"}>
        {taskID && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="已找到你在任务中心选择的通知，发送详情已在下方展开。"
            action={
              <Button
                onClick={clearFilters}
              >
                查看全部推送
              </Button>
            }
          />
        )}
        <div className="push-record-filters">
          <Input.Search
            aria-label="筛选用户编号"
            key={userID ?? ""}
            defaultValue={userID ?? ""}
            placeholder="输入用户编号筛选"
            allowClear
            className="push-user-filter"
            onSearch={(value) =>
              set({
                userID: value.trim() || undefined,
                deviceID: undefined,
                taskID: undefined,
              })
            }
          />
          <Select
            aria-label="投递状态"
            allowClear
            placeholder="全部状态"
            value={search.get("status") ?? undefined}
            onChange={(value) => set({ status: value, taskID: undefined })}
            style={{ width: 180 }}
            options={[
              "PENDING",
              "PROCESSING",
              "COMPLETED",
              "FAILED",
              "TERMINAL",
            ].map((value) => ({ value, label: STATUS[value] }))}
          />
          {userID && (
            <Select
              aria-label="筛选设备"
              allowClear
              placeholder="全部设备"
              value={search.get("deviceID") ?? undefined}
              onChange={(v) => set({ deviceID: v, taskID: undefined })}
              style={{ width: 220 }}
              options={devices.data?.items.map((d) => ({
                value: d.id,
                label: `${displayLabel("platform", d.platform)} ${displayLabel("provider", d.provider)} · ${d.id.slice(-8)}`,
              }))}
            />
          )}
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={rows.isFetching} onClick={() => void rows.refetch()}>刷新记录</Button>
            {hasFilters && <Button onClick={clearFilters}>清空筛选</Button>}
          </Space>
        </div>
        {userID && devices.isError && <PageError error={devices.error} onRetry={() => void devices.refetch()} message="设备筛选加载失败" />}
        <Table
          key={taskID ?? "all-pushes"}
          locale={{
            emptyText: taskID
              ? "这条推送记录不存在或已清理，请返回查看全部推送。"
              : "暂无符合条件的推送记录",
          }}
          rowKey="id"
          loading={rows.isFetching}
          dataSource={rows.data?.items}
          columns={columns}
          pagination={false}
          scroll={{ x: 950 }}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
            expandedRowRender: (r) => (
              <Space orientation="vertical" size={16} className="page-stack">
                <Descriptions size="small" column={{ xs: 1, md: 3 }} items={[
                  { key: "attempts", label: "尝试次数", children: r.attempts },
                  { key: "error", label: "错误类别", children: r.lastError ? <CodeValue domain="error" value={r.lastError} /> : "无" },
                  { key: "next", label: "下次尝试", children: nextTaskAttempt(r) ? formatDateTime(nextTaskAttempt(r)) : "暂无重试安排" },
                ]} />
              <Table
                rowKey="id"
                scroll={{ x: 1050 }}
                dataSource={r.deliveries}
                locale={{
                  emptyText: "暂无设备发送记录，请查看这条通知的处理结果。",
                }}
                pagination={false}
                columns={[
                  {
                    title: "设备登记",
                    dataIndex: "deviceID",
                    render: (v: string | null) =>
                      v ? <Identifier value={v} /> : "历史设备（登记已清理）",
                  },
                  {
                    title: "平台",
                    dataIndex: "platform",
                    render: (v: string | null) => (
                      <CodeValue domain="platform" value={v} />
                    ),
                  },
                  {
                    title: "渠道",
                    dataIndex: "provider",
                    render: (v: string | null) => (
                      <CodeValue domain="provider" value={v} />
                    ),
                  },
                  {
                    title: "设备投递记录",
                    dataIndex: "id",
                    render: (v: string) => <Identifier value={v} />,
                  },
                  {
                    title: "状态",
                    dataIndex: "status",
                    render: (s: string) => STATUS[s] ?? "未知状态",
                  },
                  { title: "尝试次数", dataIndex: "attempts" },
                  {
                    title: "错误类别",
                    dataIndex: "lastError",
                    render: (v: string | null) =>
                      v ? <CodeValue domain="error" value={v} /> : "—",
                  },
                  {
                    title: "发送时间",
                    dataIndex: "sentAt",
                    render: formatDateTime,
                  },
                  {
                    title: "回执时间",
                    dataIndex: "receiptCheckedAt",
                    render: formatDateTime,
                  },
                ]}
              />
              </Space>
            ),
          }}
        />
        <div className="push-record-footer"><Typography.Text type="secondary">本页 {rows.data?.items.length ?? 0} 条记录</Typography.Text>
        <Pager nextCursor={rows.data?.nextCursor} />
        </div>
      </Card>
      {userID && (
        <Card title="该用户登记的推送设备">
          {devices.isError ? (
            <PageError error={devices.error} />
          ) : (
            <Table
              rowKey="id"
              loading={devices.isFetching}
              dataSource={devices.data?.items}
              pagination={false}
              columns={[
                {
                  title: "设备登记 ID",
                  dataIndex: "id",
                  render: (v: string) => <Identifier value={v} />,
                },
                {
                  title: "渠道",
                  dataIndex: "provider",
                  render: (v: string | null) => (
                    <CodeValue domain="provider" value={v} />
                  ),
                },
                {
                  title: "平台",
                  dataIndex: "platform",
                  render: (v: string | null) => (
                    <CodeValue domain="platform" value={v} />
                  ),
                },
                { title: "App 版本", dataIndex: "appVersion" },
                {
                  title: "状态",
                  dataIndex: "disabledAt",
                  render: (v: string | null) => (v ? "已失效" : "有效"),
                },
                {
                  title: "更新时间",
                  dataIndex: "updatedAt",
                  render: formatDateTime,
                },
              ]}
            />
          )}
        </Card>
      )}
    </Space>
  );
}
