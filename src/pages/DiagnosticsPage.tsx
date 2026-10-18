import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  consoleApi,
  type Audit,
  type Event,
  type ConsolePerson,
} from "../api/console";
import { useAdminAccess } from "../auth/admin-access";
import { Identifier } from "../components/ReadableValue";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";
import { displayLabel } from "../utils/display";
import { auditActionLabel, auditEntityLabel } from "./audit-presentation";
import {
  diagnosticResult,
  diagnosticDetails,
} from "./diagnostics-presentation";
import { EVENT_LABEL, Pager, useConsoleFilters } from "./console-shared";

function Person({
  person,
  id,
  account,
}: {
  person?: ConsolePerson | null;
  id: string;
  account?: string | null;
}) {
  const { hasPermission } = useAdminAccess();
  const name = person?.nickname || person?.accountId || account || "未记录姓名";
  return (
    <Space orientation="vertical" size={0}>
      {hasPermission("USER_READ") ? (
        <Link to={`/users/${encodeURIComponent(id)}`}>{name}</Link>
      ) : (
        <span>{name}</span>
      )}
      {person?.nickname && person.accountId && (
        <Typography.Text type="secondary">
          账号：{person.accountId}
        </Typography.Text>
      )}
    </Space>
  );
}
export function DiagnosticsPage() {
  const [search] = useSearchParams();
  // Keep bookmarks from the former combined page working.
  if (search.get("mode") === "events") {
    const params = new URLSearchParams(search);
    params.delete("mode");
    params.delete("requestID");
    return <Navigate to={`/user-events?${params}`} replace />;
  }
  return <RecordsPage mode="audit" />;
}
export function UserEventsPage() {
  return <RecordsPage mode="events" />;
}
function RecordsPage({ mode }: { mode: "audit" | "events" }) {
  const { search, set } = useConsoleFilters();
  const [selected, select] = useState<
    { kind: "audit"; row: Audit } | { kind: "events"; row: Event } | null
  >(null);
  const queryParams = new URLSearchParams();
  for (const key of [
    "cursor",
    "userID",
    mode === "audit" ? "requestID" : "name",
  ]) {
    const value = search.get(key);
    if (value) queryParams.set(key, value);
  }
  const audits = useQuery({
    queryKey: ["console", "diagnostics", queryParams.toString()],
    queryFn: () => consoleApi.diagnostics(queryParams),
    enabled: mode === "audit",
    refetchInterval: 10000,
  });
  const events = useQuery({
    queryKey: ["console", "events", queryParams.toString()],
    queryFn: () => consoleApi.events(queryParams),
    enabled: mode === "events",
    refetchInterval: 10000,
  });
  const query = mode === "audit" ? audits : events;
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <Typography.Title level={3}>
        {mode === "audit" ? "问题排查" : "用户行为记录"}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {mode === "audit"
          ? "只显示失败记录。遇到后台报错时，可粘贴错误提示里的排查编号，查看失败原因和处理建议。正常管理操作请到“管理员操作记录”查看。"
          : "查看用户注册、登录、发消息、创建笔记等已采集的使用行为。后台管理操作和失败记录分别在“管理员操作记录”和“问题排查”查看。"}
        每 10 秒自动更新。
      </Typography.Paragraph>
      <Alert
        type="info"
        showIcon
        title={
          mode === "audit"
            ? "这里仅展示请求失败、登录失败和后台任务操作失败。"
            : "记录已采集的注册、登录、发消息等行为，用于了解用户的使用过程。"
        }
        description={
          mode === "audit"
            ? "先看具体失败操作和失败原因；处理建议、影响范围和排查编号在详情中。"
            : "行为记录不等于错误，也不包含聊天正文。历史未采集的行为无法在这里还原。"
        }
      />
      <Space wrap>
        {mode === "audit" ? (
          <Input.Search
            aria-label="排查编号"
            key={search.get("requestID") ?? ""}
            defaultValue={search.get("requestID") ?? ""}
            placeholder="粘贴报错提示里的排查编号"
            style={{ width: 360, maxWidth: "100%" }}
            allowClear
            onSearch={(v) => set({ requestID: v.trim() || undefined })}
          />
        ) : (
          <Select
            aria-label="用户行为"
            allowClear
            placeholder="全部用户行为"
            style={{ minWidth: 200 }}
            value={search.get("name") ?? undefined}
            onChange={(v) => set({ name: v })}
            options={Object.entries(EVENT_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        )}
        <Button loading={query.isFetching} onClick={() => void query.refetch()}>
          刷新记录
        </Button>
        {(search.get("requestID") ||
          search.get("userID") ||
          search.get("name") ||
          search.get("cursor")) && (
          <Button
            onClick={() =>
              set({
                requestID: undefined,
                userID: undefined,
                name: undefined,
                cursor: undefined,
              })
            }
          >
            清除筛选
          </Button>
        )}
      </Space>
      {query.isError ? (
        <PageError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Card>
          {mode === "audit" ? (
            <Table<Audit>
              rowKey="id"
              dataSource={audits.data?.items}
              loading={audits.isFetching}
              pagination={false}
              scroll={{ x: 1050 }}
              locale={{
                emptyText: search.get("requestID")
                  ? "没有找到这个编号对应的失败记录，请核对编号；正常操作记录请到“管理员操作记录”查看。"
                  : "暂无失败记录",
              }}
              columns={[
                {
                  title: "发生时间",
                  dataIndex: "createdAt",
                  width: 165,
                  render: formatDateTime,
                },
                {
                  title: "操作人",
                  width: 160,
                  render: (_, r) => (
                    <Person
                      person={r.actor}
                      id={r.actorID}
                      account={r.actorAccountId}
                    />
                  ),
                },
                {
                  title: "发生了什么",
                  dataIndex: "action",
                  width: 190,
                  render: (_, row) => (
                    <Space orientation="vertical" size={0}>
                      <Typography.Text strong>
                        {diagnosticDetails(row).operation ??
                          auditActionLabel(row.action)}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {diagnosticDetails(row).page}
                      </Typography.Text>
                    </Space>
                  ),
                },
                {
                  title: "记录结果",
                  width: 150,
                  render: (_, r) => {
                    const result = diagnosticResult(r.action, r.failureStatus);
                    return <Tag color={result.color}>{result.label}</Tag>;
                  },
                },
                {
                  title: "失败原因",
                  width: 240,
                  render: (_, row) => diagnosticDetails(row).cause,
                },
                {
                  title: "操作",
                  width: 90,
                  render: (_, row) => (
                    <Button
                      type="link"
                      onClick={() => select({ kind: "audit", row })}
                    >
                      查看详情
                    </Button>
                  ),
                },
              ]}
            />
          ) : (
            <Table<Event>
              rowKey="id"
              dataSource={events.data?.items}
              loading={events.isFetching}
              pagination={false}
              scroll={{ x: 850 }}
              locale={{
                emptyText:
                  "暂无符合条件的用户行为记录；未采集的历史行为不会显示。",
              }}
              columns={[
                {
                  title: "发生时间",
                  dataIndex: "createdAt",
                  render: formatDateTime,
                },
                {
                  title: "用户",
                  render: (_, r) => <Person person={r.user} id={r.userID} />,
                },
                {
                  title: "做了什么",
                  dataIndex: "name",
                  render: (v: string) => EVENT_LABEL[v] ?? "其他用户行为",
                },
                {
                  title: "记录来源",
                  dataIndex: "source",
                  render: (v: string) => displayLabel("source", v),
                },
                {
                  title: "关联内容",
                  dataIndex: "entityType",
                  render: auditEntityLabel,
                },
                {
                  title: "操作",
                  render: (_, row) => (
                    <Button
                      type="link"
                      onClick={() => select({ kind: "events", row })}
                    >
                      查看详情
                    </Button>
                  ),
                },
              ]}
            />
          )}
          <Pager nextCursor={query.data?.nextCursor} />
        </Card>
      )}
      {mode === "audit" && (
        <>
          <Typography.Paragraph type="secondary">
            需要查看完整错误或服务运行情况时，可由开发人员使用以下工具；未配置入口时请联系项目维护人员。
          </Typography.Paragraph>
          <Space wrap>
            {[
              ["服务运行监控（Grafana）", import.meta.env.VITE_GRAFANA_URL],
              ["详细错误追踪（Sentry）", import.meta.env.VITE_SENTRY_URL],
            ]
              .filter(([, url]) => !!url)
              .map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                </a>
              ))}
          </Space>
        </>
      )}
      <Modal
        title={selected?.kind === "audit" ? "后台操作详情" : "用户行为详情"}
        open={!!selected}
        onCancel={() => select(null)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        {selected && (
          <>
            <Descriptions
              bordered
              styles={{
                label: { width: 136, minWidth: 136, whiteSpace: "nowrap" },
                content: { overflowWrap: "anywhere" },
              }}
              column={1}
              size="small"
              items={
                selected.kind === "audit"
                  ? [
                      {
                        key: "action",
                        label: "发生了什么",
                        children:
                          diagnosticDetails(selected.row).operation ??
                          auditActionLabel(selected.row.action),
                      },
                      {
                        key: "person",
                        label: "操作人",
                        children: (
                          <Person
                            person={selected.row.actor}
                            id={selected.row.actorID}
                            account={selected.row.actorAccountId}
                          />
                        ),
                      },
                      {
                        key: "result",
                        label: "记录结果",
                        children: diagnosticResult(
                          selected.row.action,
                          selected.row.failureStatus,
                        ).label,
                      },
                      {
                        key: "advice",
                        label: "处理提示",
                        children: diagnosticDetails(selected.row).advice,
                      },
                      {
                        key: "failure",
                        label: "失败原因",
                        children: diagnosticDetails(selected.row).cause,
                      },
                      {
                        key: "impact",
                        label: "影响什么",
                        children: diagnosticDetails(selected.row).impact,
                      },
                      {
                        key: "method",
                        label: "请求操作",
                        children: selected.row.requestMethod || "当时未记录",
                      },
                      {
                        key: "route",
                        label: "接口模板",
                        children: selected.row.requestRoute || "当时未记录",
                      },
                      {
                        key: "time",
                        label: "发生时间",
                        children: formatDateTime(selected.row.createdAt),
                      },
                      {
                        key: "object",
                        label: "关联对象",
                        children: auditEntityLabel(selected.row.entityType),
                      },
                      {
                        key: "reason",
                        label: "操作说明",
                        children: selected.row.reason || "当时未填写说明",
                      },
                      {
                        key: "status",
                        label: "请求状态",
                        children: selected.row.failureStatus
                          ? `HTTP ${selected.row.failureStatus}`
                          : "未记录",
                      },
                      {
                        key: "code",
                        label: "原始操作代码",
                        children: (
                          <Typography.Text code>
                            {selected.row.action}
                          </Typography.Text>
                        ),
                      },
                      {
                        key: "request",
                        label: "排查编号",
                        children: (
                          <Identifier inline value={selected.row.requestId} />
                        ),
                      },
                      {
                        key: "record",
                        label: "记录编号",
                        children: <Identifier inline value={selected.row.id} />,
                      },
                      {
                        key: "personid",
                        label: "操作人编号",
                        children: (
                          <Identifier inline value={selected.row.actorID} />
                        ),
                      },
                      {
                        key: "objectid",
                        label: "对象编号",
                        children: (
                          <Identifier inline value={selected.row.entityID} />
                        ),
                      },
                    ]
                  : [
                      {
                        key: "event",
                        label: "做了什么",
                        children:
                          EVENT_LABEL[selected.row.name] ?? "其他用户行为",
                      },
                      {
                        key: "person",
                        label: "用户",
                        children: (
                          <Person
                            person={selected.row.user}
                            id={selected.row.userID}
                          />
                        ),
                      },
                      {
                        key: "time",
                        label: "发生时间",
                        children: formatDateTime(selected.row.createdAt),
                      },
                      {
                        key: "source",
                        label: "记录来源",
                        children: displayLabel("source", selected.row.source),
                      },
                      {
                        key: "platform",
                        label: "使用平台",
                        children: displayLabel(
                          "platform",
                          selected.row.platform,
                        ),
                      },
                      {
                        key: "version",
                        label: "App 版本",
                        children: selected.row.appVersion || "未记录",
                      },
                      {
                        key: "object",
                        label: "关联内容",
                        children: auditEntityLabel(selected.row.entityType),
                      },
                      {
                        key: "code",
                        label: "原始行为代码",
                        children: (
                          <Typography.Text code>
                            {selected.row.name}
                          </Typography.Text>
                        ),
                      },
                      {
                        key: "rawsource",
                        label: "原始来源代码",
                        children: selected.row.source,
                      },
                      {
                        key: "record",
                        label: "记录编号",
                        children: <Identifier inline value={selected.row.id} />,
                      },
                      {
                        key: "userid",
                        label: "用户编号",
                        children: (
                          <Identifier inline value={selected.row.userID} />
                        ),
                      },
                      {
                        key: "objectid",
                        label: "对象编号",
                        children: (
                          <Identifier inline value={selected.row.entityID} />
                        ),
                      },
                    ]
              }
            />
          </>
        )}
      </Modal>
    </Space>
  );
}
