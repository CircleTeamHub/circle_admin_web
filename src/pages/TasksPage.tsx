import { PageHeader } from "../components/PageHeader";
import { Identifier, CodeValue } from "../components/ReadableValue";
import { Link } from "react-router-dom";
import {
  notificationLabel,
  taskResult,
  nextTaskAttempt,
} from "./task-presentation";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { consoleApi, type Task } from "../api/console";
import { PageError } from "../components/PageError";
import { useAdminAccess } from "../auth/admin-access";
import { formatDateTime } from "../utils/format";
import {
  Pager,
  QUEUE_LABEL,
  STATUS,
  useConsoleFilters,
} from "./console-shared";
export function TasksPage() {
  const { search, set } = useConsoleFilters(),
    { hasPermission } = useAdminAccess();
  const isNotification =
    !search.get("kind") || search.get("kind") === "notification_push";
  const overview = useQuery({
    queryKey: ["console", "tasks-overview"],
    queryFn: consoleApi.overview,
    refetchInterval: 15000,
  });
  const rows = useQuery({
    queryKey: ["console", "tasks", search.toString()],
    queryFn: () => consoleApi.tasks(search),
    refetchInterval: 15000,
  });
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <PageHeader title="后台任务中心" description="查看待处理和失败任务，进入详情排查或重试。" />
      <Alert
        type="info"
        title="这里查看各类后台任务的处理概况。通知投递明细、设备结果和重试操作统一在“通知管理”处理。"
      />
      <Card title="队列积压" loading={overview.isPending}>
        {overview.isError ? (
          <PageError error={overview.error} />
        ) : (
          <Table
            rowKey="kind"
            dataSource={overview.data?.items}
            pagination={false}
            columns={[
              {
                title: "队列",
                dataIndex: "kind",
                render: (v: string) => QUEUE_LABEL[v] ?? v,
              },
              { title: "待处理", dataIndex: "pending" },
              {
                title: "已停止处理",
                dataIndex: "dead",
                render: (v: number | null) => v ?? "不适用",
              },
              {
                title: "最早待处理时间",
                dataIndex: "oldestAt",
                render: formatDateTime,
              },
              {
                title: "查看",
                render: (_, row) =>
                  row.kind === "notification_push" ? (
                    hasPermission("SUPPORT_MANAGE") ? (
                      <Link to="/push-operations">查看推送记录</Link>
                    ) : (
                      "需通知管理权限"
                    )
                  ) : (
                    "在下方选择任务类型查看"
                  ),
              },
            ]}
          />
        )}
        <Typography.Paragraph type="secondary">
          更新时间：
          {overview.data ? formatDateTime(overview.data.generatedAt) : "—"}
        </Typography.Paragraph>
        <Space>
          {overview.data?.groupOperations.map((g) => (
            <Tag key={g.status}>
              群管理 {STATUS[g.status] ?? g.status}：{g._count}
            </Tag>
          ))}
        </Space>
      </Card>
      <Card title="任务明细">
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            aria-label="任务队列"
            value={search.get("kind") ?? "notification_push"}
            onChange={(v) => set({ kind: v, status: undefined })}
            style={{ width: 220 }}
            options={Object.keys(QUEUE_LABEL).map((value) => ({
              value,
              label: QUEUE_LABEL[value],
            }))}
          />
          <Select
            aria-label="任务状态"
            allowClear
            placeholder="全部状态"
            value={search.get("status") ?? undefined}
            onChange={(v) => set({ status: v })}
            style={{ width: 180 }}
            options={[
              "PENDING",
              "PROCESSING",
              "COMPLETED",
              "FAILED",
              "TERMINAL",
            ].map((value) => ({ value, label: STATUS[value] }))}
          />
          <Button onClick={() => void rows.refetch()}>刷新</Button>
        </Space>
        {rows.isError && <PageError error={rows.error} />}
        {(!search.get("kind") ||
          search.get("kind") === "notification_push") && (
          <Typography.Paragraph type="secondary">
            这里只显示通知任务概况。点击“查看推送详情”查看设备投递结果或重试；任务完成不代表用户已收到或已读。
          </Typography.Paragraph>
        )}
        <Table<Task>
          rowKey="id"
          loading={rows.isFetching}
          dataSource={rows.data?.items}
          pagination={false}
          scroll={{ x: isNotification ? 800 : 1100 }}
          columns={[
            ...(!search.get("kind") ||
            search.get("kind") === "notification_push"
              ? [
                  {
                    title: "什么通知",
                    width: 180,
                    render: (_: unknown, r: Task) => (
                      <Space orientation="vertical" size={2}>
                        <span>{notificationLabel(r.notification?.type)}</span>
                      </Space>
                    ),
                  },
                  {
                    title: "发给谁",
                    width: 170,
                    render: (_: unknown, r: Task) => {
                      const id = r.notification?.toUserID;
                      return id ? (
                        <Space orientation="vertical" size={0}>
                          {hasPermission("USER_READ") ? (
                            <Link to={`/users/${encodeURIComponent(id)}`}>
                              {r.notification?.toUser?.nickname || "查看用户"}
                            </Link>
                          ) : (
                            <span>
                              {r.notification?.toUser?.nickname || "用户"}
                            </span>
                          )}
                        </Space>
                      ) : (
                        "未指定接收用户"
                      );
                    },
                  },
                ]
              : [
                  {
                    title: "任务详情",
                    dataIndex: "id",
                    width: 180,
                    render: (id: string) => (
                      <Identifier value={id} label="任务" />
                    ),
                  },
                ]),
            {
              title: "状态",
              dataIndex: "status",
              width: 110,
              render: (s: string, r: Task) => (
                <Space orientation="vertical" size={2}>
                  <Tag
                    color={
                      s === "COMPLETED"
                        ? "success"
                        : s === "FAILED" || s === "TERMINAL"
                          ? "error"
                          : "processing"
                    }
                  >
                    {STATUS[s] ?? s}
                  </Tag>
                  {!isNotification && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      尝试 {r.attempts} 次
                    </Typography.Text>
                  )}
                </Space>
              ),
            },
            ...(!isNotification
              ? [
                  {
                    title: "处理结果",
                    width: 270,
                    render: (_: unknown, r: Task) => (
                      <Space orientation="vertical" size={2}>
                        <span>{taskResult(r)}</span>
                        {r.lastError && (
                          <Typography.Text
                            type="danger"
                            style={{ fontSize: 12 }}
                          >
                            错误类别：
                            <CodeValue domain="error" value={r.lastError} />
                          </Typography.Text>
                        )}
                      </Space>
                    ),
                  },
                ]
              : []),
            {
              title: "创建时间",
              width: 150,
              dataIndex: "createdAt",
              render: formatDateTime,
            },
            ...(!isNotification
              ? [
                  {
                    title: "下次处理",
                    width: 150,
                    dataIndex: "nextAttemptAt",
                    render: (_: unknown, r: Task) =>
                      nextTaskAttempt(r)
                        ? formatDateTime(nextTaskAttempt(r))
                        : "—",
                  },
                ]
              : []),
            {
              title: "操作",
              width: isNotification ? 150 : 80,
              render: (_, r) =>
                isNotification ? (
                  hasPermission("SUPPORT_MANAGE") ? (
                    <Link
                      to={`/push-operations?taskID=${encodeURIComponent(r.id)}`}
                    >
                      查看推送详情
                    </Link>
                  ) : (
                    "需通知管理权限"
                  )
                ) : (
                  "只读"
                ),
            },
          ]}
        />
        <Pager nextCursor={rows.data?.nextCursor} />
      </Card>
    </Space>
  );
}
