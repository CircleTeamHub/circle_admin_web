import { Identifier, CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import {
  notificationLabel,
  nextTaskAttempt,
  taskResult,
} from "./task-presentation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import { consoleApi, type Push } from "../api/console";
import { listUsers } from "../api/users";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";
import {
  Pager,
  ReasonAction,
  STATUS,
  useConsoleFilters,
} from "./console-shared";

function RecipientPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const users = useQuery({
    queryKey: ["console", "recipient-search", keyword],
    queryFn: () => listUsers({ keyword, page: 1, limit: 20 }),
    enabled: keyword.length >= 2,
  });
  return (
    <Select
      mode="multiple"
      aria-label="收件人"
      showSearch
      filterOption={false}
      placeholder="输入账号或昵称搜索收件人"
      searchValue={keyword}
      onSearch={setKeyword}
      value={value}
      onChange={onChange}
      maxCount={100}
      style={{ minWidth: 360 }}
      options={users.data?.items.map((u) => ({
        value: u.id,
        label: `${u.nickname || u.accountId} · ${u.accountId}`,
      }))}
      loading={users.isFetching}
    />
  );
}
export function PushOperationsPage() {
  const { search, set } = useConsoleFilters(),
    { hasPermission } = useAdminAccess();
  const overview = useQuery({
    queryKey: ["console", "push-overview"],
    queryFn: consoleApi.pushOverview,
    refetchInterval: 15000,
  });
  const rows = useQuery({
    queryKey: ["console", "push", search.toString()],
    queryFn: () => consoleApi.pushes(search),
    refetchInterval: 15000,
  });
  const announcements = useQuery({
    queryKey: ["console", "announcements"],
    queryFn: consoleApi.announcements,
    enabled: hasPermission("CONTENT_MANAGE"),
  });
  const [recipients, setRecipients] = useState<string[]>([]),
    [announcement, setAnnouncement] = useState<string>();
  const userID = search.get("userID");
  const taskID = search.get("taskID");
  const devices = useQuery({
    queryKey: ["console", "push-devices", userID],
    queryFn: () => consoleApi.devices(userID!),
    enabled: !!userID,
  });
  const columns = [
    { title: "时间", dataIndex: "createdAt", render: formatDateTime },
    {
      title: "收件人",
      render: (_: unknown, r: Push) =>
        r.notification.toUserID ? (
          <Space orientation="vertical" size={0}>
            <Link to={`/users/${encodeURIComponent(r.notification.toUserID)}`}>
              {r.notification.toUser?.nickname || "查看用户"}
            </Link>
            <Identifier value={r.notification.toUserID} label="用户" />
          </Space>
        ) : (
          "—"
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (s: string) => <Tag>{STATUS[s] ?? "未知状态"}</Tag>,
    },
    {
      title: "通知类型",
      render: (_: unknown, r: Push) => notificationLabel(r.notification.type),
    },
    { title: "处理结果", render: (_: unknown, r: Push) => taskResult(r) },
    { title: "次数", dataIndex: "attempts" },
    {
      title: "错误类别",
      dataIndex: "lastError",
      render: (v: string | null) =>
        v ? <CodeValue domain="error" value={v} /> : "—",
    },
    {
      title: "下次尝试",
      render: (_: unknown, r: Push) =>
        nextTaskAttempt(r) ? formatDateTime(nextTaskAttempt(r)) : "—",
    },
    {
      title: "操作",
      render: (_: unknown, r: Push) =>
        r.status === "FAILED" ? (
          <ReasonAction
            title="重试失败设备"
            path={`/admin/console/push/${r.id}/retry`}
            payload={{ version: r.updatedAt }}
          />
        ) : (
          "—"
        ),
    },
  ];
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <Typography.Title level={3}>通知管理</Typography.Title>
      {[overview, rows].map((q, i) =>
        q.isError ? (
          <PageError key={i} error={q.error} onRetry={() => void q.refetch()} />
        ) : null,
      )}
      <Card title="投递渠道与开关" loading={overview.isPending}>
        <Space wrap>
          {overview.data?.providers.map((p) => (
            <Tag key={p.name} color={p.configured ? "green" : "orange"}>
              {displayLabel("provider", p.name)}：
              {p.configured ? "已配置" : "未配置"}
            </Tag>
          ))}
          <Tag color={overview.data?.settings.enabled ? "green" : "orange"}>
            全局推送{overview.data?.settings.enabled ? "开启" : "暂停"}
          </Tag>
          {overview.data && hasPermission("CONTENT_MANAGE") && (
            <ReasonAction
              title={overview.data.settings.enabled ? "暂停推送" : "恢复推送"}
              path="/admin/console/push/settings"
              method="PATCH"
              payload={{
                enabled: !overview.data.settings.enabled,
                version: overview.data.settings.version,
              }}
              danger={overview.data.settings.enabled}
              confirmText={
                overview.data.settings.enabled ? "暂停推送" : undefined
              }
            />
          )}
        </Space>
        <Typography.Paragraph type="secondary">
          “渠道已接受”表示推送服务已接收发送请求；“回执已记录”表示系统已记录渠道确认或超时处理结果，都不代表用户已收到或已读。暂停后，正在发送的请求可能继续完成，待处理任务会保留。
        </Typography.Paragraph>
        <Space wrap>
          {overview.data?.counts.map((s) => (
            <Tag key={s.status}>
              {STATUS[s.status] ?? "未知状态"}：{s._count}
            </Tag>
          ))}
        </Space>
      </Card>
      {hasPermission("CONTENT_MANAGE") && (
        <Card title="定向公告推送">
          <Space wrap>
            <RecipientPicker value={recipients} onChange={setRecipients} />
            <Select
              aria-label="已发布公告"
              placeholder="选择已发布公告"
              value={announcement}
              onChange={setAnnouncement}
              style={{ width: 320 }}
              options={announcements.data?.items.map((a) => ({
                value: a.id,
                label: a.content.slice(0, 80),
              }))}
            />
            {recipients.length > 0 && announcement && (
              <ReasonAction
                title="发送定向公告"
                path="/admin/console/push/send"
                payload={{ recipients, announcementID: announcement }}
                confirmText="发送公告"
                onDone={() => {
                  setRecipients([]);
                  setAnnouncement(undefined);
                }}
              />
            )}
          </Space>
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            title="同一公告对同一收件人只创建一次通知；失败重试保留同一操作标识。发送内容为选中的已发布公告。"
          />
          {announcements.isError && <PageError error={announcements.error} />}
        </Card>
      )}
      <Card title={taskID ? "推送详情" : "投递记录"}>
        {taskID && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="已定位任务中心选择的通知任务，下面展开显示设备投递明细。"
            action={
              <Button
                onClick={() =>
                  set({
                    taskID: undefined,
                    cursor: undefined,
                    userID: undefined,
                    deviceID: undefined,
                    status: undefined,
                  })
                }
              >
                查看全部推送
              </Button>
            }
          />
        )}
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            aria-label="筛选用户编号"
            key={userID ?? ""}
            defaultValue={userID ?? ""}
            placeholder="用户编号（可从用户详情跳转）"
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
          <Button onClick={() => void rows.refetch()}>刷新</Button>
        </Space>
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
          scroll={{ x: 1100 }}
          expandable={{
            defaultExpandedRowKeys: taskID ? [taskID] : [],
            expandedRowRender: (r) => (
              <Table
                rowKey="id"
                dataSource={r.deliveries}
                locale={{
                  emptyText: "未找到设备投递明细，请结合上方处理结果判断。",
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
            ),
          }}
        />
        <Pager nextCursor={rows.data?.nextCursor} />
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
