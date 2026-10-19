import { ReloadOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Identifier } from "../components/ReadableValue";
import { conversationTitle } from "./im-presentation";
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
  Avatar,
  Button,
  Card,
  Drawer,
  Input,
  Tabs,
  Space,
  Table,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  const { hasPermission } = useAdminAccess();
  const includeArchives = hasPermission("IM_ARCHIVE_READ");
  const [filters, setFilters] = useState<ImFilters>({ reason: "" });
  const [submitted, setSubmitted] = useState<ImFilters>();
  const [rows, setRows] = useState<ImMessage[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const generation = useRef(0);
  const request = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (q: ImFilters) => {
      const results = await Promise.all([
        queryImMessages(conversation.id, q, false),
        ...(includeArchives ? [queryImMessages(conversation.id, q, true)] : []),
      ]);
      // Both sources use the same conversation height. Page the merged timeline
      // at its last displayed height so neither source can skip older messages.
      const unique = new Map<number, ImMessage>();
      for (const result of results) {
        for (const item of result.items) {
          if (!unique.has(item.height)) unique.set(item.height, item);
        }
      }
      const merged = [...unique.values()].sort((a, b) => b.height - a.height);
      const items = merged.slice(0, 30);
      const hasMore = merged.length > items.length || results.some((r) => r.nextCursor !== null);
      return { items, nextCursor: hasMore ? (items.at(-1)?.height ?? null) : null };
    },
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
        message={includeArchives
          ? "每次查询需填写原因并记录审计。此账号可同时查看仍在180天留存期内的焚毁记录；加密文字需在已授权设备上解锁。"
          : "每次查询需填写原因并记录审计。已撤回、删除、清空及到期焚毁内容不可查看；阅后即焚消息到期后需重新查询。"}
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
        <PageError
          error={request.error}
          message="消息查询失败"
          onRetry={() => void run(false)}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get("type") === "GROUP" ? "GROUP" : "DIRECT";
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ImConversation>();
  const sessions = useQuery({
    queryKey: ["admin-im", keyword, type, page],
    queryFn: () => listImConversations(keyword, type, page),
  });
  return (
    <Space orientation="vertical" size={16} className="page-stack im-conversations">
      <div>
      <Typography.Title level={3} style={{ margin: 0 }}>会话与聊天记录</Typography.Title>
      <Typography.Paragraph type="secondary">
        {type === "GROUP"
          ? "点击群名查看群资料，点击人数查看群成员；聊天记录从右侧按钮进入。"
          : "点击会话名称查看双方资料；聊天记录从右侧按钮进入。"}
      </Typography.Paragraph>
      </div>
      <Card className="im-conversations-card">
      <Tabs
        activeKey={type}
        items={[
          { key: "DIRECT", label: "私聊" },
          { key: "GROUP", label: "群聊" },
        ]}
        onChange={(value) => {
          setSearchParams((params) => {
            params.set("type", value);
            return params;
          });
          setPage(1);
          setSelected(undefined);
        }}
      />
      <div className="im-conversations-toolbar">
        <Input.Search
          aria-label="搜索会话"
          placeholder={type === "GROUP"
            ? "搜索群名称，或输入会话 / 圈子 / 成员 ID"
            : "输入会话或成员 ID 搜索私聊"}
          allowClear
          className="im-conversations-search"
          onSearch={(v) => {
            setKeyword(v);
            setPage(1);
          }}
        />
        <Space>
          <Typography.Text type="secondary" aria-live="polite">
            {sessions.data ? `共 ${sessions.data.total} 个${type === "GROUP" ? "群聊" : "私聊"}` : "正在加载会话"}
          </Typography.Text>
          <Button icon={<ReloadOutlined />} loading={sessions.isFetching} onClick={() => void sessions.refetch()}>刷新</Button>
        </Space>
      </div>
      {sessions.isError && (
        <PageError
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
        />
      )}
      <Table<ImConversation>
        rowKey="id"
        loading={sessions.isFetching}
        dataSource={sessions.data?.items}
        tableLayout="fixed"
        scroll={{ x: type === "GROUP" ? 760 : 660 }}
        locale={{ emptyText: keyword ? "没有找到匹配的会话，请调整搜索条件" : `暂无${type === "GROUP" ? "群聊" : "私聊"}` }}
        pagination={{
          current: page,
          pageSize: 20,
          total: sessions.data?.total,
          showSizeChanger: false,
          onChange: setPage,
          hideOnSinglePage: true,
        }}
        columns={[
          {
            title: type === "GROUP" ? "群聊" : "会话",
            width: 260,
            render: (_, r) => (
              <Space align="start" size={12} style={{ maxWidth: "100%" }}>
                <Avatar
                  shape="square"
                  size={40}
                  icon={r.type === "GROUP" ? <TeamOutlined /> : <UserOutlined />}
                  style={{ background: r.type === "GROUP" ? "#f0eaff" : "#eaf2ff", color: r.type === "GROUP" ? "#6941c6" : "#2563eb", flexShrink: 0 }}
                />
                <div className="im-conversation-identity">
                  <div className="im-conversation-name-row">
                    {r.type === "GROUP" ? (
                      hasPermission("COMMUNITY_MANAGE") ? (
                        <Link
                          to={`/community/groups/${encodeURIComponent(r.id)}`}
                          title={conversationTitle(r)}
                          className="im-conversation-title"
                        >
                          {conversationTitle(r)}
                        </Link>
                      ) : (
                        <Typography.Text strong>{conversationTitle(r)}</Typography.Text>
                      )
                    ) : (
                      <Link
                        to={`/im/conversations/${encodeURIComponent(r.id)}`}
                        title={conversationTitle(r)}
                        className="im-conversation-title"
                      >
                        {conversationTitle(r)}
                      </Link>
                    )}
                  </div>

                </div>
              </Space>
            ),
          },
          {
            title: type === "GROUP" ? "群成员" : "参与人",
            width: 230,
            render: (_, r) => r.type === "GROUP" ? (
              hasPermission("COMMUNITY_MANAGE") || hasPermission("IM_MODERATE") ? (
                <Link
                  className="im-group-member-count"
                  aria-label={`查看${conversationTitle(r)}的群成员，共${r.memberCount}人`}
                  to={hasPermission("COMMUNITY_MANAGE")
                    ? `/community/groups/${encodeURIComponent(r.id)}?tab=members`
                    : `/im/conversations/${encodeURIComponent(r.id)}/members`}
                >
                  {r.memberCount} 人
                </Link>
              ) : (
                <span className="im-group-member-count">{r.memberCount} 人</span>
              )
            ) : (
              <div className="im-direct-participants">
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

              </div>
            ),
          },
          {
            title: "操作",
            width: type === "GROUP" ? 240 : 130,
            render: (_, r) => (
              <Space orientation={r.type === "GROUP" ? "horizontal" : "vertical"} wrap size={[12, 8]}>
                <Button onClick={() => setSelected(r)}>
                  {selected?.id === r.id ? "正在查看记录" : "查看聊天记录"}
                </Button>
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
      <Typography.Paragraph type="secondary" className="im-conversations-note">
        仅支持当前聊天系统保存的记录。加密文字需在已授权设备上解锁后查看。
      </Typography.Paragraph>
      </Card>
      {selected && selected.type === type && (
        <Drawer
          open
          title="聊天记录"
          size="min(1100px, 100vw)"
          onClose={() => setSelected(undefined)}
        >
          <History
            key={selected.id}
            conversation={selected}
            onClose={() => setSelected(undefined)}
          />
        </Drawer>
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
