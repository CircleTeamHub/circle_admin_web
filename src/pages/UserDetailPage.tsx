import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Card,
  Col,
  Descriptions,
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
import type { AdminAuditLog, AuthUser, SensitiveField } from "../types";
import { formatDateTime } from "../utils/format";

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
  const { userId = "" } = useParams();
  const detail = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getUserDetail(userId),
    enabled: !!userId,
  });
  const audit = useQuery({
    queryKey: ["admin-user-audit", userId],
    queryFn: () => listUserAuditLogs(userId, 20),
    enabled: !!userId,
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
  const auditColumns: ColumnsType<AdminAuditLog> = [
    { title: "操作", dataIndex: "action" },
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
            {data.profile.nickname.slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <Typography.Title level={3}>{data.profile.nickname}</Typography.Title>
            <Typography.Text code>{data.profile.accountId}</Typography.Text>
          </div>
        </Space>
        <Space>
          <Tag>{data.profile.role}</Tag>
          <Tag
            color={
              data.profile.status === "ACTIVE"
                ? "green"
                : data.profile.status === "BANNED"
                  ? "red"
                  : "default"
            }
          >
            {data.profile.status}
          </Tag>
        </Space>
      </Space>

      <div className="admin-user-card-grid">
        <Card title="账户资料">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="用户 ID">{data.profile.id}</Descriptions.Item>
            <Descriptions.Item label="账号 ID">{data.profile.accountId}</Descriptions.Item>
            <Descriptions.Item label="昵称">{data.profile.nickname}</Descriptions.Item>
            <Descriptions.Item label="城市">{data.profile.city || "-"}</Descriptions.Item>
            <Descriptions.Item label="地区">{data.profile.region || "-"}</Descriptions.Item>
            <Descriptions.Item label="性别">{data.profile.gender}</Descriptions.Item>
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
            <Descriptions.Item label="OpenIM 同步">
              {data.security.openimSynced ? "是" : "否"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="VIP">
          <Typography.Title level={5}>新的月度 VIP 系统设计中</Typography.Title>
          <Typography.Paragraph type="secondary">
            当前版本不读取旧 VIP 等级，也不提供升级或兑换操作。
          </Typography.Paragraph>
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

      <Card title="危险操作">
        <UserStatusActions
          key={userId}
          userId={userId}
          accountId={data.profile.accountId}
          status={data.profile.status}
          currentUser={currentUser}
        />
      </Card>

      <Card title="最近 Admin 操作">
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
    </Space>
  );
}
