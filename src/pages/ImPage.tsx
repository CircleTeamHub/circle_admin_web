import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  listImConversations,
  queryImMessages,
  type ImConversation,
  type ImFilters,
  type ImMessage,
} from "../api/admin-im";
import { AdminMessageContent } from "../components/AdminMessageContent";
import { useAdminAccess } from "../auth/admin-access";

function History({ conversation }: { conversation: ImConversation }) {
  const [filters, setFilters] = useState<ImFilters>({ reason: "" });
  const [submitted, setSubmitted] = useState<ImFilters>();
  const [rows, setRows] = useState<ImMessage[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const generation = useRef(0);
  const request = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (q: ImFilters) => queryImMessages(conversation.id, q),
  });
  const clear = () => {
    generation.current++;
    setRows([]);
    setCursor(null);
    setSubmitted(undefined);
    request.reset();
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        generation.current++;
        setRows([]);
        setCursor(null);
        setSubmitted(undefined);
        request.reset();
      }
    };
    document.addEventListener("visibilitychange", hide);
    const timer = window.setInterval(
      () =>
        setRows((items) =>
          items.filter(
            (m) => !m.visibleUntil || Date.parse(m.visibleUntil) > Date.now(),
          ),
        ),
      1000,
    );
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", hide);
      window.clearInterval(timer);
    };
  }, []);
  const run = async (older: boolean, renewCursor?: number) => {
    const q =
      older && submitted
        ? { ...submitted, cursor: cursor ?? undefined }
        : renewCursor !== undefined && submitted
          ? { ...submitted, cursor: renewCursor }
          : { ...filters };
    const revision = ++generation.current;
    if (!older) {
      setRows([]);
      setCursor(null);
    }
    try {
      const result = await request.mutateAsync(q);
      request.reset();
      if (revision !== generation.current) return;
      setRows((items) =>
        older ? [...items, ...result.items].slice(-300) : result.items,
      );
      setCursor(result.nextCursor);
      setSubmitted(q);
      request.reset();
    } catch {
      /* mutation error is rendered; reason and filters stay available */
    }
  };
  return (
    <Card title={`消息访问 · ${conversation.name ?? conversation.id}`}>
      <Alert
        type="warning"
        showIcon
        message="每次查询必须填写访问原因并写入审计。仅提供自研持久化历史；已撤回、删除、清空及到期焚毁内容不可查看。"
      />
      <Space wrap style={{ margin: "16px 0" }}>
        <Input
          aria-label="访问原因"
          placeholder="访问原因（2–500 字）"
          maxLength={500}
          value={filters.reason}
          onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
        />
        <Input
          aria-label="发送者 ID"
          placeholder="发送者 UUID"
          value={filters.senderId ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, senderId: e.target.value || undefined })
          }
        />
        <Input
          aria-label="文本过滤"
          placeholder="当前会话文本过滤"
          maxLength={200}
          value={filters.text ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, text: e.target.value || undefined })
          }
        />
        <Input
          aria-label="开始日期"
          type="datetime-local"
          onChange={(e) =>
            setFilters({
              ...filters,
              from: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            })
          }
        />
        <Input
          aria-label="结束日期"
          type="datetime-local"
          onChange={(e) =>
            setFilters({
              ...filters,
              to: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            })
          }
        />
        <Button
          type="primary"
          loading={request.isPending}
          disabled={filters.reason.trim().length < 2 || request.isPending}
          onClick={() => void run(false)}
        >
          审计并查询
        </Button>
        <Button onClick={clear}>清除已访问内容</Button>
      </Space>
      {request.isError && (
        <Alert
          type="error"
          message="消息查询失败；请确认权限、过滤条件及审计服务可用后重试。"
        />
      )}
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={false}
        loading={request.isPending}
        locale={{
          emptyText: submitted
            ? "无符合条件的可用消息"
            : "填写原因后主动查询消息",
        }}
        columns={[
          {
            title: "时间",
            dataIndex: "createdAt",
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "发送者",
            dataIndex: "senderId",
            render: (v: string | null) => v ?? "系统",
          },
          {
            title: "内容",
            render: (_, m) => (
              <AdminMessageContent
                key={`${m.id}:${m.mediaExpiresAt ?? "none"}`}
                message={m}
                renewalPending={request.isPending}
                onRenew={() => void run(false, m.height + 1)}
              />
            ),
          },
        ]}
      />
      <Button
        disabled={!cursor || request.isPending}
        onClick={() => void run(true)}
      >
        加载更早消息（再次审计）
      </Button>
    </Card>
  );
}
export function ImPage() {
  const { hasPermission } = useAdminAccess();
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<string>();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ImConversation>();
  const sessions = useQuery({
    queryKey: ["admin-im", keyword, type, page],
    queryFn: () => listImConversations(keyword, type, page),
  });
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Title level={3}>IM 会话管理</Typography.Title>
      <Space>
        <Input.Search
          aria-label="搜索会话"
          placeholder="会话 ID / 群名称 / 圈子 ID / 成员 ID"
          onSearch={(v) => {
            setKeyword(v);
            setPage(1);
          }}
        />
        <Select
          aria-label="会话类型"
          allowClear
          placeholder="全部类型"
          style={{ width: 140 }}
          options={[
            { value: "DIRECT", label: "单聊" },
            { value: "GROUP", label: "群聊" },
          ]}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
        />
        <Button onClick={() => void sessions.refetch()}>刷新</Button>
      </Space>
      {sessions.isError && <Alert type="error" message="会话列表加载失败" />}
      <Alert
        type="info"
        message="仅显示自研持久化会话。旧 OpenIM 服务历史未接入，无法在此查询。"
      />
      <Table<ImConversation>
        rowKey="id"
        loading={sessions.isFetching}
        dataSource={sessions.data?.items}
        pagination={{
          current: page,
          pageSize: 20,
          total: sessions.data?.total,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "会话",
            render: (_, r) => (
              <span>
                {r.name ?? r.id}
                <br />
                {r.type} · {r.memberCount} 人
              </span>
            ),
          },
          {
            title: "成员摘要",
            render: (_, r) => r.participants.map((p) => p.nickname).join("、"),
          },
          {
            title: "圈子",
            dataIndex: "circleID",
            render: (v: string | null) => v ?? "独立会话",
          },
          {
            title: "操作",
            render: (_, r) => (
              <Space>
                <Button onClick={() => setSelected(r)}>查询消息</Button>
                {r.type === "GROUP" && hasPermission("IM_MODERATE") && (
                  <Link to={`/im/conversations/${r.id}/members`}>群成员</Link>
                )}
              </Space>
            ),
          },
        ]}
      />
      {selected && <History key={selected.id} conversation={selected} />}
    </Space>
  );
}
