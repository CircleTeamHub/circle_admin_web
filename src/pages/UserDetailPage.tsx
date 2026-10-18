import { UserResourcesCard } from "./UserResourcesCard";
import { Identifier, CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import { auditActionLabel } from "./audit-presentation";
import { UserTimelineCard } from "./UserTimelineCard";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Card,
  Col,
  Descriptions,
  Image,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link, useParams } from "react-router-dom";
import { getUserDetail, listUserAuditLogs } from "../api/users";
import { PageError } from "../components/PageError";
import { SensitiveFieldValue } from "../components/SensitiveFieldValue";
import { UserStatusActions } from "../components/UserStatusActions";
import { UserAvatarFramesCard } from "../components/UserAvatarFramesCard";
import type { AdminAuditLog, AuthUser, SensitiveField } from "../types";
import { formatDateTime } from "../utils/format";
import { useAdminAccess } from "../auth/admin-access";

const CONTACT_LABELS: Array<[SensitiveField, string]> = [
  ["email", "邮箱"],
  ["phoneNumber", "手机号"],
  ["wechat", "微信"],
  ["qq", "QQ"],
  ["whatsup", "WhatsApp"],
];

const SUMMARY_LABELS = {
  creditScore: "信用分",
  walletBalance: "钱包余额",
  friendCount: "好友数",
  noteCount: "笔记数",
  traceCount: "动态数",
  circlesOwnedCount: "创建圈子",
  circleMembershipCount: "加入圈子",
  reportsFiledCount: "发起举报",
  reportsReceivedCount: "被举报",
} as const;

export function UserDetailPage({ currentUser }: { currentUser: AuthUser }) {
  const { hasPermission } = useAdminAccess();
  const { userId = "" } = useParams();
  const detail = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getUserDetail(userId),
    enabled: !!userId,
  });
  const audit = useQuery({
    queryKey: ["admin-user-audit", userId],
    queryFn: () => listUserAuditLogs(userId, 20),
    enabled: !!userId && hasPermission("AUDIT_READ"),
  });

  const backlink = <Link to="/users">返回用户列表</Link>;
  if (detail.isLoading) {
    return (
      <Space orientation="vertical" size={16} className="page-stack">
        {backlink}
        <Spin />
        <Typography.Text>正在加载用户详情…</Typography.Text>
      </Space>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <Space orientation="vertical" size={16} className="page-stack">
        {backlink}
        <PageError
          error={detail.error}
          onRetry={() => detail.refetch()}
          message="用户详情加载失败"
        />
      </Space>
    );
  }

  const data = detail.data;
  const displayName = data.profile.nickname || data.profile.accountId;
  const auditColumns: ColumnsType<AdminAuditLog> = [
    {
      title: "操作",
      dataIndex: "action",
      render: (value: string) => (
        <span title={value}>{auditActionLabel(value)}</span>
      ),
    },
    { title: "管理员", dataIndex: "actorAccountId" },
    { title: "原因", dataIndex: "reason", render: (value) => value || "-" },
    {
      title: "时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDateTime(value),
    },
  ];

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      {backlink}
      <Space className="page-title-row" wrap>
        <Space>
          <Avatar size={56} src={data.profile.avatarUrl || undefined}>
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <Typography.Title level={3}>{displayName}</Typography.Title>
            <Typography.Text code>{data.profile.accountId}</Typography.Text>
          </div>
        </Space>
        <Space>
          <Tag title={data.profile.role}>
            {displayLabel("userRole", data.profile.role)}
          </Tag>
          <Tag
            color={
              data.profile.status === "ACTIVE"
                ? "green"
                : data.profile.status === "BANNED"
                  ? "red"
                  : "default"
            }
          >
            {displayLabel("userStatus", data.profile.status)}
          </Tag>
        </Space>
      </Space>

      {data.profile.cover && (
        <Card title="个人主页封面">
          <Image
            src={data.profile.cover}
            alt="个人主页封面"
            style={{ maxHeight: 280, objectFit: "cover" }}
          />
        </Card>
      )}
      <Card title="App 个人资料">
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "persona",
              label: "个性签名",
              children: (
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {data.profile.persona || "未填写"}
                </span>
              ),
            },
            {
              key: "hello",
              label: "打招呼用语",
              children: data.profile.helloWords || "未填写",
            },
            {
              key: "birthday",
              label: "生日",
              children: data.profile.birthday
                ? data.profile.birthday.slice(0, 10)
                : "未填写",
            },
            {
              key: "likes",
              label: "累计获赞",
              children: data.profile.receivedLikeCount ?? "未记录",
            },
            {
              key: "icons",
              label: "展示图标与徽章",
              span: 2,
              children: data.profile.displayIcons?.length ? (
                <Space wrap>
                  {data.profile.displayIcons.map((icon) => (
                    <Space key={icon.id}>
                      {icon.imageUrl && (
                        <Image
                          src={icon.imageUrl}
                          alt={icon.title}
                          width={32}
                          height={32}
                        />
                      )}
                      <Tag>{icon.title}</Tag>
                      {icon.circleId && hasPermission("COMMUNITY_MANAGE") && (
                        <Link
                          to={`/community/circles/${encodeURIComponent(icon.circleId)}`}
                        >
                          {icon.circleName || "查看圈子"}
                        </Link>
                      )}
                    </Space>
                  ))}
                </Space>
              ) : (
                "未设置"
              ),
            },
          ]}
        />
      </Card>
      <div className="admin-user-card-grid">
        <Card title="账户资料">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="用户 ID">
              <Identifier value={data.profile.id} inline />
            </Descriptions.Item>
            <Descriptions.Item label="账号 ID">
              {data.profile.accountId}
            </Descriptions.Item>
            <Descriptions.Item label="昵称">
              {data.profile.nickname}
            </Descriptions.Item>
            <Descriptions.Item label="城市">
              {data.profile.city || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="地区">
              {data.profile.region || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="性别">
              <CodeValue domain="gender" value={data.profile.gender} />
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {formatDateTime(data.profile.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {formatDateTime(data.profile.updatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="最后在线">
              {formatDateTime(data.profile.lastOnline)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="联系信息">
          <Space orientation="vertical" size={14}>
            {CONTACT_LABELS.map(([field, label]) => (
              <SensitiveFieldValue
                key={`${userId}:${field}`}
                userId={userId}
                field={field}
                label={label}
                maskedValue={data.maskedContacts[field]}
                allowReveal={hasPermission("USER_SENSITIVE")}
              />
            ))}
          </Space>
        </Card>

        <Card title="安全与同步">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="安全码锁定">
              {data.security.securityCodeLocked ? "是" : "否"}
            </Descriptions.Item>
            <Descriptions.Item label="单设备登录">
              {data.security.singleDeviceLoginEnabled ? "是" : "否"}
            </Descriptions.Item>
            <Descriptions.Item label="活跃会话">
              {data.security.activeSessionCount}
            </Descriptions.Item>
            <Descriptions.Item label="推送设备">
              {data.security.activePushDeviceCount}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="VIP">
          {hasPermission("COMMERCE_MANAGE") ? (
            <Link
              to={`/memberships?search=${encodeURIComponent(data.profile.accountId)}`}
            >
              查看会员等级、有效期及发放记录
            </Link>
          ) : (
            <Typography.Text>会员操作需要运营权限。</Typography.Text>
          )}
        </Card>
      </div>

      <Card title="业务概览">
        <Row gutter={[16, 16]}>
          {Object.entries(SUMMARY_LABELS).map(([key, label]) => (
            <Col xs={12} md={8} xl={6} key={key}>
              <Statistic
                title={label}
                value={data.summary[key as keyof typeof SUMMARY_LABELS]}
              />
            </Col>
          ))}
        </Row>
      </Card>

      <UserResourcesCard key={`resources:${userId}`} userID={userId} />
      {hasPermission("COMMERCE_MANAGE") && (
        <UserAvatarFramesCard key={`avatar-frames:${userId}`} userId={userId} />
      )}

      {hasPermission("USER_MODERATE") && (
        <Card title="危险操作">
          <UserStatusActions
            key={userId}
            userId={userId}
            accountId={data.profile.accountId}
            status={data.profile.status}
            currentUser={currentUser}
          />
        </Card>
      )}

      {hasPermission("AUDIT_READ") && (
        <Card title="最近管理员操作">
          {audit.isError ? (
            <PageError
              error={audit.error}
              onRetry={() => audit.refetch()}
              message="审计记录加载失败"
            />
          ) : (
            <Table
              rowKey="id"
              size="small"
              loading={audit.isLoading}
              columns={auditColumns}
              dataSource={audit.data || []}
              pagination={false}
            />
          )}
        </Card>
      )}
      <UserTimelineCard userID={userId} />
    </Space>
  );
}
