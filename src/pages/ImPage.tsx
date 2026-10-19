import { Identifier } from "../components/ReadableValue";
import { conversationTitle, conversationTypeLabel } from "./im-presentation";
import { formatDateTime } from "../utils/format";
import { PageError } from "../components/PageError";
import {
  AdminEncryption,
  AdminEncryptedText,
} from "../components/AdminEncryption";
import type { EncryptedContent } from "@circle/e2ee/relay-client.mjs";
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
  Tag,
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

function History({
  conversation,
  onClose,
}: {
  conversation: ImConversation;
  onClose: () => void;
}) {
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
    <Card
      title={`聊天记录 · ${conversationTitle(conversation)}`}
      extra={<Button onClick={onClose}>关闭记录</Button>}
    >
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
        tableLayout="fixed"
        scroll={{ x: 800 }}
        columns={[
          {
            title: "时间",
            width: 180,
            dataIndex: "createdAt",
            render: formatDateTime,
          },
          {
            title: "发送者",
            width: 180,
            dataIndex: "senderId",
            render: (v: string | null) =>
              v ? (
                <Space orientation="vertical" size={2}>
                  <span>
                    {conversation.participants.find((p) => p.id === v)
                      ?.nickname || "会话成员"}
                  </span>
                  <Identifier value={v} label="发送者" />
                </Space>
              ) : (
                "系统"
              ),
          },
          {
            title: "内容",
            render: (_, m) =>
              m.type === "encrypted-text" ? (
                <AdminEncryptedText
                  content={m.content as unknown as EncryptedContent}
                  reason={submitted?.reason ?? ""}
                />
              ) : (
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
function ImPageContent() {
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
      <Typography.Title level={3}>会话与聊天记录</Typography.Title>
      <Typography.Paragraph type="secondary">
        先找到会话，再填写访问原因查询聊天记录。加密文字需在已授权设备上解锁后查看。
      </Typography.Paragraph>
      <Space wrap>
        <Input.Search
          aria-label="搜索会话"
          placeholder="搜索群名称，或输入会话 / 圈子 / 成员 ID"
          allowClear
          style={{ width: 380, maxWidth: "100%" }}
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
      {sessions.isError && (
        <PageError
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
        />
      )}
      <Alert
        type="info"
        title="这里只列出当前聊天系统保存的会话；旧聊天系统的历史记录暂不支持查询。"
      />
      <Table<ImConversation>
        rowKey="id"
        loading={sessions.isFetching}
        dataSource={sessions.data?.items}
        tableLayout="fixed"
        scroll={{ x: 1080 }}
        locale={{ emptyText: "没有找到符合条件的会话" }}
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
            width: 260,
            render: (_, r) => (
              <Space
                orientation="vertical"
                size={2}
                style={{ maxWidth: "100%" }}
              >
                {r.type === "GROUP" && hasPermission("COMMUNITY_MANAGE") ? (
                  <Link to={`/community/groups/${encodeURIComponent(r.id)}`}>
                    {conversationTitle(r)}
                  </Link>
                ) : (
                  <Typography.Text
                    strong
                    ellipsis={{ tooltip: conversationTitle(r) }}
                    style={{ maxWidth: 220 }}
                  >
                    {conversationTitle(r)}
                  </Typography.Text>
                )}
                <Identifier value={r.id} label="会话" />
              </Space>
            ),
          },
          {
            title: "类型 / 人数",
            width: 120,
            render: (_, r) => (
              <Space orientation="vertical" size={2}>
                <Tag color={r.type === "DIRECT" ? "blue" : "purple"}>
                  {conversationTypeLabel(r.type)}
                </Tag>
                <Typography.Text type="secondary">
                  {r.memberCount} 人
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: "参与人",
            width: 230,
            render: (_, r) => (
              <Space orientation="vertical" size={2}>
                {r.participants.length ? (
                  r.participants.map((p) =>
                    hasPermission("USER_READ") ? (
                      <Link
                        key={p.id}
                        to={`/users/${encodeURIComponent(p.id)}`}
                        title={p.id}
                      >
                        {p.nickname || "未命名用户"}
                      </Link>
                    ) : (
                      <span key={p.id} title={p.id}>
                        {p.nickname || "未命名用户"}
                      </span>
                    ),
                  )
                ) : (
                  <Typography.Text type="secondary">
                    暂无当前成员
                  </Typography.Text>
                )}
                {r.memberCount > r.participants.length && (
                  <Typography.Text type="secondary">
                    共 {r.memberCount} 人，仅显示前 {r.participants.length} 人
                  </Typography.Text>
                )}
              </Space>
            ),
          },
          {
            title: "所属圈子",
            width: 180,
            render: (_, r) =>
              r.circleID ? (
                <Space orientation="vertical" size={2}>
                  {hasPermission("COMMUNITY_MANAGE") ? <Link
                    to={`/community/circles/${encodeURIComponent(r.circleID)}`}
                  >
                    {r.circle?.name || "查看圈子详情"}
                  </Link> : <span>{r.circle?.name || "关联圈子"}</span>}
                </Space>
              ) : (
                "独立会话"
              ),
          },
          {
            title: "最近消息时间",
            width: 160,
            render: (_, r) =>
              r.lastMessageAt
                ? formatDateTime(r.lastMessageAt)
                : "未记录消息时间",
          },
          {
            title: "操作",
            width: 130,
            render: (_, r) => (
              <Space orientation="vertical" size={4}>
                <Button type="link" onClick={() => setSelected(r)}>
                  {selected?.id === r.id ? "正在查看记录" : "查看聊天记录"}
                </Button>
                {r.type === "GROUP" && hasPermission("COMMUNITY_MANAGE") && (
                  <Link to={`/community/groups/${encodeURIComponent(r.id)}`}>
                    群聊详情
                  </Link>
                )}
                {r.type === "GROUP" && hasPermission("IM_MODERATE") && (
                  <Link
                    to={`/im/conversations/${encodeURIComponent(r.id)}/members`}
                  >
                    管理群成员
                  </Link>
                )}
              </Space>
            ),
          },
        ]}
      />
      {selected && (
        <History
          key={selected.id}
          conversation={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </Space>
  );
}

export function ImPage() {
  return (
    <AdminEncryption>
      <ImPageContent />
    </AdminEncryption>
  );
}

export function ConversationHistory({
  conversation,
  onClose,
}: {
  conversation: ImConversation;
  onClose: () => void;
}) {
  return (
    <AdminEncryption>
      <History conversation={conversation} onClose={onClose} />
    </AdminEncryption>
  );
}
