import {
  AlertOutlined,
  ReloadOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getDashboard,
  type DashboardRange,
  type DashboardSection,
} from "../api/dashboard";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";

const RANGE_OPTIONS: Array<{ label: string; value: DashboardRange }> = [
  { label: "今日", value: "today" },
  { label: "最近 7 天", value: "7d" },
  { label: "最近 30 天", value: "30d" },
];

function opsLinks() {
  return [
    ["Grafana", import.meta.env.VITE_GRAFANA_URL],
    ["Sentry", import.meta.env.VITE_SENTRY_URL],
    ["Uptime Kuma", import.meta.env.VITE_UPTIME_KUMA_URL],
    ["Alertmanager", import.meta.env.VITE_ALERTMANAGER_URL],
  ].filter(([, url]) => !!url);
}

function valueOf<T>(section: DashboardSection<T> | undefined): T | null {
  return section?.status === "ok" ? section.data : null;
}

function SectionUnavailable({ title }: { title: string }) {
  return <Alert type="warning" showIcon title={`${title}暂时不可用`} />;
}

function SectionPending({ title }: { title: string }) {
  return <Alert type="info" showIcon title={`${title}尚未获取`} />;
}

function SignupTrend({
  values,
}: {
  values: Array<{ date: string; value: number }>;
}) {
  const maximum = Math.max(1, ...values.map((item) => item.value));
  return (
    <div className="dashboard-trend" aria-label="新增用户趋势">
      {values.map((item) => (
        <div className="dashboard-trend-column" key={item.date}>
          <Typography.Text type="secondary">{item.value}</Typography.Text>
          <div
            className="dashboard-trend-bar"
            style={{ height: `${Math.max(6, (item.value / maximum) * 92)}px` }}
          />
          <Typography.Text type="secondary">
            {item.date.slice(5)}
          </Typography.Text>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("today");
  const dashboard = useQuery({
    queryKey: ["adminDashboard", range],
    queryFn: () => getDashboard(range),
    refetchInterval: 60_000,
  });
  const users = valueOf(dashboard.data?.sections.users);
  const community = valueOf(dashboard.data?.sections.community);
  const commerce = valueOf(dashboard.data?.sections.commerce);
  const moderation = valueOf(dashboard.data?.sections.moderation);
  const system = valueOf(dashboard.data?.sections.system);
  const pendingTotal =
    moderation && system
      ? moderation.pendingTotal + system.failed
      : null;

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <Space className="page-title-row" align="start">
        <div>
          <Typography.Title level={3}>运营驾驶舱</Typography.Title>
          <Typography.Text type="secondary">
            用户、社区、商城与系统状态统一总览
          </Typography.Text>
        </div>
        <Space wrap>
          <Segmented
            options={RANGE_OPTIONS}
            value={range}
            onChange={(value) => setRange(value as DashboardRange)}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={dashboard.isFetching}
            onClick={() => dashboard.refetch()}
          >
            刷新
          </Button>
        </Space>
      </Space>

      {dashboard.isError ? (
        <PageError
          error={dashboard.error}
          onRetry={() => dashboard.refetch()}
          message="Dashboard 加载失败"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card loading={dashboard.isLoading}>
            <Statistic
              title="用户总数"
              value={users?.totalUsers ?? "--"}
              prefix={<TeamOutlined />}
              suffix={
                users ? (
                  <Typography.Text type="success">
                    +{users.newUsers}
                  </Typography.Text>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={dashboard.isLoading}>
            <Statistic
              title="活跃用户"
              value={users?.activeUsers ?? "--"}
              prefix={<RiseOutlined />}
              suffix={
                users?.totalUsers
                  ? `${((users.activeUsers / users.totalUsers) * 100).toFixed(1)}%`
                  : users
                    ? "0%"
                    : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={dashboard.isLoading}>
            <Statistic
              title="积分消费"
              value={commerce?.pointSpend ?? "--"}
              prefix={<ShopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={dashboard.isLoading}>
            <Statistic
              title="待处理事项"
              value={pendingTotal ?? "--"}
              prefix={<AlertOutlined />}
              styles={{
                content:
                  pendingTotal !== null && pendingTotal > 0
                    ? { color: "#cf1322" }
                    : undefined,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Typography.Title level={4}>用户与社区运营</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="新增用户趋势" loading={dashboard.isLoading}>
            {dashboard.data?.sections.users.status === "error" ? (
              <SectionUnavailable title="用户数据" />
            ) : (
              <SignupTrend values={users?.signupTrend ?? []} />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="社区概况" loading={dashboard.isLoading}>
            {dashboard.data?.sections.community.status === "error" ? (
              <SectionUnavailable title="社区数据" />
            ) : (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="圈子总数">
                  {community?.totalCircles ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="期间新增圈子">
                  {community?.newCircles ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="期间新增动态">
                  {community?.newPosts ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="期间新增成员">
                  {community?.newMembers ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="封禁用户">
                  {users?.bannedUsers ?? 0}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>

      <Typography.Title level={4}>商城经营</Typography.Title>
      {dashboard.data?.sections.commerce.status === "error" ? (
        <SectionUnavailable title="商城数据" />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic title="有效会员" value={commerce?.activeMembers ?? 0} />
              <Typography.Text type="secondary">
                期间新增 {commerce?.newMemberships ?? 0}
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title="使用中靓号"
                value={commerce?.activeFancyNumbers ?? 0}
              />
              <Typography.Text type="secondary">
                {commerce?.fancyNumberOrders ?? 0} 笔订单 ·{" "}
                {commerce?.fancyNumberSpend ?? 0} 积分
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title="扩容卡订单"
                value={commerce?.expansionOrders ?? 0}
              />
              <Typography.Text type="secondary">
                消费 {commerce?.expansionSpend ?? 0} 积分
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card>
              <Statistic
                title="积分充值"
                value={commerce?.pointRecharge ?? 0}
              />
              <Typography.Text type="secondary">
                消费 {commerce?.pointSpend ?? 0} 积分
              </Typography.Text>
            </Card>
          </Col>
        </Row>
      )}

      <Typography.Title level={4}>治理与系统健康</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                待处理队列
              </Space>
            }
            extra={<Link to="/reports">进入举报审核</Link>}
          >
            {dashboard.data?.sections.moderation.status === "error" ? (
              <SectionUnavailable title="治理数据" />
            ) : (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="待处理总计">
                  {moderation?.pendingTotal ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="用户举报">
                  {moderation?.pendingFriendReports ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="群聊举报">
                  {moderation?.pendingGroupReports ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="动态举报">
                  {moderation?.pendingPostReports ?? 0}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Outbox 状态" loading={dashboard.isLoading}>
            {!dashboard.data ? (
              <SectionPending title="系统状态" />
            ) : dashboard.data.sections.system.status === "error" ? (
              <SectionUnavailable title="系统数据" />
            ) : (
              <Space orientation="vertical">
                <Space wrap>
                  {(
                    [
                      ["API", system?.services.api],
                      ["数据库", system?.services.database],
                      ["Redis", system?.services.redis],
                      ["OpenIM", system?.services.openim],
                    ] as const
                  ).map(([name, status]) => (
                    <Tag
                      key={name}
                      color={status === "healthy" ? "green" : "red"}
                    >
                      <span>{name}</span>{" "}
                      <span>{status === "healthy" ? "正常" : "异常"}</span>
                    </Tag>
                  ))}
                </Space>
                <Space wrap>
                  <Tag color="gold">待处理 {system?.pending ?? 0}</Tag>
                  <Tag color="blue">处理中 {system?.processing ?? 0}</Tag>
                  <Tag color={system?.failed ? "red" : "green"}>
                    失败 {system?.failed ?? 0}
                  </Tag>
                </Space>
                <Typography.Text type="secondary">
                  最老待处理：
                  {system?.oldestPendingAt
                    ? formatDateTime(system.oldestPendingAt)
                    : "无"}
                </Typography.Text>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="运维快捷链接">
        <Space wrap>
          {opsLinks().length > 0 ? (
            opsLinks().map(([name, url]) => (
              <a key={name} href={url} target="_blank" rel="noreferrer">
                {name}
              </a>
            ))
          ) : (
            <Typography.Text type="secondary">
              可通过 VITE_GRAFANA_URL 等环境变量配置运维入口
            </Typography.Text>
          )}
        </Space>
      </Card>

      {dashboard.data ? (
        <Typography.Text type="secondary">
          最后更新：{formatDateTime(dashboard.data.generatedAt)} · 每 60 秒自动刷新
        </Typography.Text>
      ) : null}
    </Space>
  );
}
