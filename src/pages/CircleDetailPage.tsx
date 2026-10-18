import { PostSignupsButton } from "../components/PostSignupsButton";
import { useAdminAccess } from "../auth/admin-access";
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
  Pagination,
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
  getAdminCircle,
  getAdminCircleMembers,
  getAdminCirclePosts,
  type AdminCirclePost,
  type CirclePerson,
} from "../api/community";
import { Identifier } from "../components/ReadableValue";
import { PageError } from "../components/PageError";
import { displayLabel } from "../utils/display";

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
const yes = (value: boolean) => (value ? "允许" : "不允许");
const names = (values: string[]) =>
  values.length ? values.join("、") : "未设置";
export function Person({ user }: { user: CirclePerson }) {
  const { hasPermission } = useAdminAccess();
  return (
    <Space>
      <Avatar src={user.avatarUrl}>
        {(user.nickname || user.accountId).slice(0, 1)}
      </Avatar>
      <Space orientation="vertical" size={0}>
        {hasPermission("USER_READ") ? (
          <Link to={`/users/${encodeURIComponent(user.id)}`}>
            {user.nickname || user.accountId}
          </Link>
        ) : (
          <Typography.Text>{user.nickname || user.accountId}</Typography.Text>
        )}
        <Typography.Text type="secondary">{user.accountId}</Typography.Text>
      </Space>
    </Space>
  );
}
const restrictions = (
  vip: number | null,
  credit: number | null,
  fancy: boolean,
) =>
  [
    vip == null ? "VIP 不限" : `VIP ${vip} 及以上`,
    credit == null ? "信用分不限" : `信用分 ${credit} 及以上`,
    fancy ? "须有靓号" : "靓号不限",
  ].join("；");

function CircleMembers({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["circle-detail-members", id, page],
    queryFn: () => getAdminCircleMembers(id, page),
  });
  if (query.isError)
    return <PageError error={query.error} onRetry={() => query.refetch()} />;
  return (
    <>
      <Typography.Paragraph type="secondary">
        包含已入圈成员、待审批与已拒绝的申请记录。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        loading={query.isPending}
        dataSource={query.data?.items ?? []}
        scroll={{ x: 650 }}
        pagination={{
          current: page,
          pageSize: 20,
          total: query.data?.total ?? 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条成员与申请记录`,
        }}
        expandable={{
          expandedRowRender: (r) => (
            <Descriptions
              column={1}
              items={[
                {
                  key: "membership",
                  label: "成员记录编号",
                  children: <Identifier value={r.id} inline />,
                },
                {
                  key: "user",
                  label: "用户内部编号",
                  children: <Identifier value={r.user.id} inline />,
                },
              ]}
            />
          ),
        }}
        columns={[
          { title: "成员", render: (_, r) => <Person user={r.user} /> },
          {
            title: "圈内角色",
            dataIndex: "role",
            render: (v: string) =>
              v === "OWNER" ? "圈主" : displayLabel("memberRole", v),
          },
          {
            title: "入圈状态",
            dataIndex: "status",
            render: (v: string) =>
              ({ ACTIVE: "已入圈", PENDING: "待审批", REJECTED: "申请已拒绝" })[
                v
              ] ?? "未识别状态",
          },
          { title: "申请 / 加入时间", dataIndex: "createdAt", render: date },
        ]}
      />
    </>
  );
}
export function Post({ post }: { post: AdminCirclePost }) {
  return (
    <Card
      title={<Person user={post.author} />}
      extra={<Tag>{displayLabel("contentStatus", post.status)}</Tag>}
    >
      <Typography.Paragraph
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {post.content || "未填写文字内容"}
      </Typography.Paragraph>
      <Image.PreviewGroup>
        <Space wrap>
          {post.images.map((url, index) => (
            <Image
              key={`${index}-${url}`}
              width={120}
              height={120}
              style={{ objectFit: "cover" }}
              src={url}
              alt={`动态图片 ${index + 1}`}
            />
          ))}
        </Space>
      </Image.PreviewGroup>
      <Space wrap>
        {post.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </Space>
      <Descriptions
        size="small"
        column={{ xs: 1, md: 2 }}
        items={[
          { key: "time", label: "发布时间", children: date(post.createdAt) },
          { key: "update", label: "更新时间", children: date(post.updatedAt) },
          {
            key: "circle",
            label: "发布圈子",
            children: names([
              ...new Set([
                post.circle.name,
                ...post.circleLinks.map((link) => link.circle.name),
              ]),
            ]),
          },
          {
            key: "city",
            label: "城市",
            children: names(
              post.cities.length ? post.cities : post.city ? [post.city] : [],
            ),
          },
          {
            key: "counts",
            label: "浏览 / 报名",
            children: (
              <Space wrap>
                <Typography.Text>
                  {post.viewCount} 次浏览 / {post.signupCount} 人报名
                </Typography.Text>
                <PostSignupsButton postID={post.id} />
              </Space>
            ),
          },
          {
            key: "horn",
            label: "喇叭动态",
            children: post.isHorn ? "是" : "否",
          },
          {
            key: "view",
            label: "查看门槛",
            children: restrictions(
              post.vipRestriction,
              post.creditRestriction,
              post.fancyRestriction,
            ),
          },
          {
            key: "signup",
            label: "报名门槛",
            children: restrictions(
              post.signupVipRestriction,
              post.signupCreditRestriction,
              post.signupFancyRestriction,
            ),
          },
          { key: "ended", label: "结束时间", children: date(post.endedAt) },
          { key: "expiry", label: "到期时间", children: date(post.expiresAt) },
        ]}
      />
      <Collapse
        size="small"
        items={[
          {
            key: "ids",
            label: "内部编号（排查使用）",
            children: (
              <Space orientation="vertical">
                <Typography.Text>
                  动态编号：
                  <Identifier value={post.id} inline />
                </Typography.Text>
                {post.noteID && (
                  <Typography.Text>
                    关联笔记编号：
                    <Identifier value={post.noteID} inline />
                  </Typography.Text>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
function CirclePosts({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["circle-detail-posts", id, page],
    queryFn: () => getAdminCirclePosts(id, page),
  });
  if (query.isError)
    return <PageError error={query.error} onRetry={() => query.refetch()} />;
  return (
    <Spin spinning={query.isPending}>
      <Space orientation="vertical" style={{ width: "100%" }} size={16}>
        <Typography.Text type="secondary">
          包含发布到本圈子的动态，以及已结束、已删除的记录；分页加载。
        </Typography.Text>
        {query.data?.items.length === 0 && <Empty description="暂无动态" />}
        {query.data?.items.map((post) => (
          <Post key={post.id} post={post} />
        ))}
        <Pagination
          current={page}
          pageSize={20}
          total={query.data?.total ?? 0}
          onChange={setPage}
          showSizeChanger={false}
          showTotal={(total) => `共 ${total} 条动态`}
        />
      </Space>
    </Spin>
  );
}
export function CircleDetailPage() {
  const { circleId = "" } = useParams();
  const query = useQuery({
    queryKey: ["circle-detail", circleId],
    queryFn: () => getAdminCircle(circleId),
    enabled: !!circleId,
  });
  const back = <Link to="/community">返回圈子列表</Link>;
  if (query.isError)
    return (
      <Space orientation="vertical">
        {back}
        <PageError error={query.error} onRetry={() => query.refetch()} />
      </Space>
    );
  if (query.isPending) return <Spin aria-label="正在加载圈子详情" />;
  const c = query.data;
  const g = c.associatedGroup;
  const basic = (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      {c.cover && (
        <Image
          src={c.cover}
          alt="圈子封面"
          style={{ maxHeight: 280, objectFit: "cover" }}
        />
      )}
      <Card title="圈子资料">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "owner",
              label: "圈主",
              children: <Person user={c.owner} />,
            },
            { key: "name", label: "圈子名称", children: c.name },
            {
              key: "avatar",
              label: "头像",
              children: c.avatarUrl ? (
                <Image src={c.avatarUrl} alt="圈子头像" width={80} />
              ) : (
                "未设置"
              ),
            },
            {
              key: "icon",
              label: "当前圈子图标",
              children: c.currentIconUrl ? (
                <Image src={c.currentIconUrl} alt="当前圈子图标" width={80} />
              ) : (
                "未设置"
              ),
            },
            {
              key: "desc",
              label: "简介 / 群公告",
              span: 2,
              children: (
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {c.description || "未填写"}
                </span>
              ),
            },
            {
              key: "rules",
              label: "圈子规则",
              span: 2,
              children: (
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {c.rules || "未填写"}
                </span>
              ),
            },
            { key: "categories", label: "分类", children: names(c.categories) },
            { key: "tags", label: "标签", children: names(c.tags) },
            { key: "cities", label: "关联城市", children: names(c.cities) },
            {
              key: "public",
              label: "公开性",
              children: c.isPublic ? "公开圈子" : "非公开圈子",
            },
            {
              key: "count",
              label: "成员 / 动态",
              children: `${c.memberCount} 人 / ${c.postCount} 条动态`,
            },
            {
              key: "capacity",
              label: "成员容量",
              children:
                c.maxMembers == null ? "未设置上限" : `${c.maxMembers} 人`,
            },
            {
              key: "seats",
              label: "已购买扩容席位",
              children: `${c.expansionSeats} 个`,
            },
            {
              key: "join",
              label: "入圈门槛",
              span: 2,
              children: restrictions(
                c.joinVipRestriction,
                c.joinCreditRestriction,
                c.joinFancyRestriction,
              ),
            },
            {
              key: "post",
              label: "发布动态",
              children: c.memberCanPost
                ? "所有成员可发布"
                : "仅圈主和管理员可发布",
            },
            {
              key: "invite",
              label: "邀请入圈",
              children: c.memberCanInvite
                ? "所有成员可邀请"
                : "仅圈主和管理员可邀请",
            },
            {
              key: "verify",
              label: "入圈所需担保人数",
              children: `${c.requiredVerifierCount} 人`,
            },
            { key: "created", label: "创建时间", children: date(c.createdAt) },
            { key: "updated", label: "更新时间", children: date(c.updatedAt) },
          ]}
        />
      </Card>
      <Card
        title="实际关联群聊"
        extra={
          g ? (
            <Link to={`/community/groups/${encodeURIComponent(g.id)}`}>
              查看群聊完整详情
            </Link>
          ) : undefined
        }
      >
        {g ? (
          <Descriptions
            bordered
            column={{ xs: 1, md: 2 }}
            items={[
              { key: "name", label: "群聊名称", children: c.name },
              {
                key: "mute",
                label: "全员禁言",
                children: g.muteAllAt
                  ? `已开启（${date(g.muteAllAt)}）`
                  : "未开启",
              },
              {
                key: "encrypt",
                label: "文字加密",
                children:
                  g.textEncryption === "PLAIN"
                    ? "未启用端到端加密"
                    : g.textEncryption === "MLS_V1"
                      ? "已启用端到端加密"
                      : "未识别配置",
              },
              { key: "qr", label: "扫码加入", children: yes(g.qrJoinEnabled) },
              {
                key: "card",
                label: "通过群名片加入",
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
        ) : (
          <Empty description="尚未建立群聊" />
        )}
      </Card>
      <Card title="后台管理状态">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "state",
              label: "管理状态",
              children:
                {
                  ACTIVE: "正常",
                  DISABLING: "停用同步中",
                  DISABLED: "已停用 / 禁言",
                  RESTORING: "恢复同步中",
                  SYNC_FAILED: "同步失败",
                  DISMISSED: "群聊已永久解散",
                }[c.adminState] ?? "未识别状态",
            },
            {
              key: "deleted",
              label: "圈子存续",
              children: c.deleted ? "已解散 / 删除" : "存续中",
            },
            {
              key: "disabled",
              label: "停用时间",
              children: date(c.adminDisabledAt),
            },
            {
              key: "reason",
              label: "停用原因",
              children: c.adminDisableReason || "—",
            },
          ]}
        />
      </Card>
      <Collapse
        items={[
          {
            key: "ids",
            label: "内部编号（排查使用）",
            children: (
              <Descriptions
                column={1}
                items={[
                  {
                    key: "circle",
                    label: "圈子内部编号",
                    children: <Identifier value={c.id} inline />,
                  },
                  {
                    key: "chat",
                    label: "群聊内部编号",
                    children: <Identifier value={g?.id} inline />,
                  },
                  {
                    key: "owner",
                    label: "圈主内部编号",
                    children: <Identifier value={c.owner.id} inline />,
                  },
                  {
                    key: "admin",
                    label: "停用操作人编号",
                    children: <Identifier value={c.adminDisabledBy} inline />,
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
        <Avatar size={56} src={c.avatarUrl} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {c.name}
        </Typography.Title>
        <Button onClick={() => query.refetch()} loading={query.isFetching}>
          刷新资料
        </Button>
      </Space>
      {c.deleted && (
        <Alert
          type="warning"
          title="此圈子已解散或删除，当前展示保留的历史资料。"
        />
      )}
      <Tabs
        destroyOnHidden
        items={[
          { key: "profile", label: "圈子详情", children: basic },
          {
            key: "members",
            label: "成员与申请",
            children: <CircleMembers key={circleId} id={circleId} />,
          },
          {
            key: "posts",
            label: "圈子动态",
            children: <CirclePosts key={circleId} id={circleId} />,
          },
        ]}
      />
    </Space>
  );
}
