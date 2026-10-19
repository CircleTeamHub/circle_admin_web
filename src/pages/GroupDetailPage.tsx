import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Image,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAdminGroup,
  getAdminGroupMembers,
  getAdminGroupEvents,
  type AdminGroupEvent,
} from "../api/community";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { Identifier } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import { Person } from "./CircleDetailPage";
import { ConversationHistory } from "./ImPage";
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
const yes = (value: boolean) => (value ? "允许" : "不允许");
export function groupEventDescription(event: AdminGroupEvent) {
  const p = event.payload ?? {};
  const labels: Record<string, string> = {
    "group-created": "创建群聊",
    "member-joined": p.via === "qr" ? "扫码入群" : "加入群聊",
    "member-left": "退出群聊",
    "member-removed": "移出群成员",
    "member-role-changed": p.role === "ADMIN" ? "设为管理员" : "取消管理员",
    "member-silenced": "禁言成员",
    "member-unsilenced": "解除成员禁言",
    "owner-transferred": "转让群主",
    "group-renamed": "修改群名称",
    "group-notice-updated": "更新群公告",
    "history-cleared": "清空全群聊天记录",
    "mute-all-changed": p.enabled === true ? "开启全员禁言" : "关闭全员禁言",
    "group-avatar-updated": "更新群头像",
    "policy-changed": "修改群权限",
  };
  let result = labels[event.kind] ?? "群聊活动";
  if (event.kind === "group-renamed" && typeof p.name === "string")
    result += `：${p.name}`;
  if (event.kind === "member-silenced")
    result +=
      typeof p.durationSec === "number" && p.durationSec > 0
        ? `（${p.durationSec} 秒）`
        : "（直到解除）";
  if (event.kind === "policy-changed") {
    const policy: Record<string, string> = {
      memberCanInvite: "成员邀请入群",
      qrJoinEnabled: "扫码加入",
      cardJoinEnabled: "群名片加入",
      joinApprovalRequired: "入群审批",
      membersCanViewProfiles: "成员查看资料",
      membersCanViewRoster: "成员查看名单",
      membersCanAddFriends: "成员互加好友",
    };
    result += `：${typeof p.policy === "string" ? (policy[p.policy] ?? "群设置") : "群设置"}（${p.enabled === true ? "已开启" : p.enabled === false ? "已关闭" : "未记录结果"}）`;
  }
  return result;
}
function GroupRoster({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["group-details-members", id, page],
    queryFn: () => getAdminGroupMembers(id, page),
  });
  const { hasPermission } = useAdminAccess();
  if (q.isError)
    return <PageError error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Text type="secondary">
        展示在群成员与已离群记录；点击成员姓名查看用户资料。
      </Typography.Text>
      {hasPermission("IM_MODERATE") && (
        <Link to={`/im/conversations/${encodeURIComponent(id)}/members`}>
          管理成员角色与禁言
        </Link>
      )}
      <Table
        rowKey="id"
        loading={q.isPending}
        dataSource={q.data?.items ?? []}
        scroll={{ x: 850 }}
        pagination={{
          current: page,
          pageSize: 20,
          total: q.data?.total ?? 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条成员记录`,
        }}
        expandable={{
          expandedRowRender: (r) => (
            <Descriptions
              column={1}
              items={[
                {
                  key: "id",
                  label: "成员记录编号",
                  children: <Identifier value={r.id} inline />,
                },
                {
                  key: "user",
                  label: "用户内部编号",
                  children: <Identifier value={r.userID} inline />,
                },
              ]}
            />
          ),
        }}
        columns={[
          {
            title: "成员",
            render: (_, r) =>
              r.user ? <Person user={r.user} /> : "已注销用户",
          },
          {
            title: "群昵称",
            dataIndex: "alias",
            render: (v: string | null) => v || "未单独设置",
          },
          {
            title: "角色",
            dataIndex: "role",
            render: (v: string) => displayLabel("memberRole", v),
          },
          {
            title: "成员状态",
            render: (_, r) => (
              <Tag color={r.leftAt ? undefined : "green"}>
                {r.leftAt ? "已离群" : "在群"}
              </Tag>
            ),
          },
          {
            title: "禁言状态",
            render: (_, r) =>
              r.silencedAt &&
              (!r.silencedUntil ||
                new Date(r.silencedUntil).getTime() > Date.now())
                ? r.silencedUntil
                  ? `禁言至 ${date(r.silencedUntil)}`
                  : "禁言中，直到解除"
                : "未禁言",
          },
          { title: "加入时间", dataIndex: "joinedAt", render: date },
          { title: "离群时间", dataIndex: "leftAt", render: date },
        ]}
      />
    </Space>
  );
}
function GroupEvents({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["group-details-events", id, page],
    queryFn: () => getAdminGroupEvents(id, page),
  });
  if (q.isError)
    return <PageError error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Table
      rowKey="id"
      loading={q.isPending}
      dataSource={q.data?.items ?? []}
      scroll={{ x: 650 }}
      pagination={{
        current: page,
        pageSize: 20,
        total: q.data?.total ?? 0,
        onChange: setPage,
        showSizeChanger: false,
        showTotal: (total) => `共 ${total} 条群日志`,
      }}
      columns={[
        { title: "发生了什么", render: (_, r) => groupEventDescription(r) },
        {
          title: "操作人",
          render: (_, r) =>
            r.actor ? <Person user={r.actor} /> : "系统或已注销用户",
        },
        {
          title: "涉及成员",
          render: (_, r) => (
            <Space orientation="vertical">
              {r.targets.length
                ? r.targets.map((user) => <Person key={user.id} user={user} />)
                : "—"}
            </Space>
          ),
        },
        { title: "时间", dataIndex: "createdAt", render: date },
      ]}
    />
  );
}
export function GroupDetailPage() {
  const { conversationId = "" } = useParams();
  const [tab, setTab] = useState("profile");
  const { hasPermission } = useAdminAccess();
  const q = useQuery({
    queryKey: ["group-details", conversationId],
    queryFn: () => getAdminGroup(conversationId),
    enabled: !!conversationId,
  });
  const back = <Link to="/community">返回圈子与群聊</Link>;
  if (q.isError)
    return (
      <Space orientation="vertical">
        {back}
        <PageError error={q.error} onRetry={() => q.refetch()} />
      </Space>
    );
  if (q.isPending) return <Spin aria-label="正在加载群聊详情" />;
  const g = q.data;
  const profile = (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Card title="群聊资料">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            { key: "name", label: "群名称", children: g.name },
            {
              key: "type",
              label: "群类型",
              children: g.circleID ? "圈子关联群" : "独立群聊",
            },
            {
              key: "avatar",
              label: "群头像",
              children: g.avatarUrl ? (
                <Image width={100} src={g.avatarUrl} alt="群头像" />
              ) : (
                "未设置"
              ),
            },
            {
              key: "owner",
              label: "群主",
              children: g.owner ? (
                <Person user={g.owner} />
              ) : (
                "未设置或账号已注销"
              ),
            },
            {
              key: "notice",
              label: "群公告",
              span: 2,
              children: (
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {g.notice || "未填写"}
                </span>
              ),
            },
            {
              key: "circle",
              label: "关联圈子",
              children: g.circle ? (
                <Link
                  to={`/community/circles/${encodeURIComponent(g.circle.id)}`}
                >
                  {g.circle.name}
                </Link>
              ) : (
                "独立群聊"
              ),
            },
            {
              key: "count",
              label: "当前在群人数",
              children: `${g.memberCount} 人`,
            },
            { key: "create", label: "创建时间", children: date(g.createdAt) },
            { key: "update", label: "更新时间", children: date(g.updatedAt) },
            {
              key: "last",
              label: "最近消息时间",
              children: date(g.lastMessageAt),
            },
          ]}
        />
      </Card>
      <Card title="群权限与安全设置">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "mute",
              label: "全员禁言",
              children: g.muteAllAt
                ? `已开启（${date(g.muteAllAt)}）`
                : "未开启",
            },
            {
              key: "encryption",
              label: "文字加密",
              children:
                g.textEncryption === "PLAIN"
                  ? "未启用端到端加密"
                  : g.textEncryption === "MLS_V1"
                    ? "已启用端到端加密"
                    : "未识别配置",
            },
            {
              key: "invite",
              label: "成员邀请入群",
              children: yes(g.memberCanInvite),
            },
            { key: "qr", label: "扫码加入", children: yes(g.qrJoinEnabled) },
            {
              key: "card",
              label: "群名片加入",
              children: yes(g.cardJoinEnabled),
            },
            {
              key: "approval",
              label: "入群审批",
              children: g.joinApprovalRequired ? "需要审批" : "无需审批",
            },
            {
              key: "roster",
              label: "成员查看群成员名单",
              children: yes(g.membersCanViewRoster),
            },
            {
              key: "profile",
              label: "成员查看他人资料",
              children: yes(g.membersCanViewProfiles),
            },
            {
              key: "friend",
              label: "成员相互添加好友",
              children: yes(g.membersCanAddFriends),
            },
          ]}
        />
      </Card>
      <Collapse
        items={[
          {
            key: "id",
            label: "内部编号（排查使用）",
            children: (
              <Descriptions
                column={1}
                items={[
                  {
                    key: "group",
                    label: "群聊内部编号",
                    children: <Identifier value={g.id} inline />,
                  },
                  {
                    key: "circle",
                    label: "圈子内部编号",
                    children: <Identifier value={g.circleID} inline />,
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </Space>
  );
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      {back}
      <Space>
        <Avatar size={56} src={g.avatarUrl} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {g.name}
        </Typography.Title>
        <Button onClick={() => q.refetch()} loading={q.isFetching}>
          刷新资料
        </Button>
      </Space>
      {g.circle?.deleted && (
        <Alert
          type="warning"
          title="关联圈子已解散或删除，当前显示保留的历史资料。"
        />
      )}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        destroyOnHidden
        items={[
          { key: "profile", label: "群聊详情", children: profile },
          {
            key: "members",
            label: "群成员",
            children: <GroupRoster key={g.id} id={g.id} />,
          },
          {
            key: "events",
            label: "群日志",
            children: <GroupEvents key={g.id} id={g.id} />,
          },
          ...(hasPermission("IM_READ")
            ? [
                {
                  key: "history",
                  label: "聊天记录",
                  children: (
                    <ConversationHistory
                      key={g.id}
                      conversation={{
                        id: g.id,
                        type: "GROUP",
                        name: g.name,
                        circleID: g.circleID,
                        circle: g.circle,
                        memberCount: g.memberCount,
                        participants: [],
                        lastMessageAt: g.lastMessageAt,
                      }}
                      onClose={() => setTab("profile")}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </Space>
  );
}
