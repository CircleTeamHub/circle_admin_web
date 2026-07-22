import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Row, Space, Statistic, Typography } from "antd";
import { listFriendReports } from "../api/reports";
import { getOutboxHealth } from "../api/system";
import { listUsers } from "../api/users";
import { PageError } from "../components/PageError";

function opsLinks() {
  return [
    ["Grafana", import.meta.env.VITE_GRAFANA_URL],
    ["Sentry", import.meta.env.VITE_SENTRY_URL],
    ["Uptime Kuma", import.meta.env.VITE_UPTIME_KUMA_URL],
    ["Alertmanager", import.meta.env.VITE_ALERTMANAGER_URL],
  ].filter(([, url]) => !!url);
}

export function DashboardPage() {
  const pendingReports = useQuery({
    queryKey: ["dashboard", "pendingReports"],
    queryFn: () => listFriendReports({ status: "PENDING", page: 1, limit: 1 }),
  });
  const totalUsers = useQuery({
    queryKey: ["dashboard", "totalUsers"],
    queryFn: () => listUsers({ page: 1, limit: 1 }),
  });
  const bannedUsers = useQuery({
    queryKey: ["dashboard", "bannedUsers"],
    queryFn: () => listUsers({ page: 1, limit: 1, status: "BANNED" }),
  });
  const outbox = useQuery({
    queryKey: ["outboxHealth"],
    queryFn: getOutboxHealth,
  });
  const queries = [pendingReports, totalUsers, bannedUsers, outbox];
  const failedQuery = queries.find((query) => query.isError);
  const refreshAll = () => queries.forEach((query) => query.refetch());

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Space className="page-title-row">
        <Typography.Title level={3}>Dashboard</Typography.Title>
        <Button onClick={refreshAll}>刷新</Button>
      </Space>
      {failedQuery ? (
        <PageError error={failedQuery.error} onRetry={refreshAll} message="Dashboard 加载不完整" />
      ) : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card loading={pendingReports.isLoading}>
            <Statistic title="待处理举报" value={pendingReports.data?.total || 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card loading={totalUsers.isLoading}>
            <Statistic title="用户总数" value={totalUsers.data?.total || 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card loading={bannedUsers.isLoading}>
            <Statistic title="封禁用户" value={bannedUsers.data?.total || 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card loading={outbox.isLoading}>
            <Statistic
              title="Outbox failed"
              value={(outbox.data?.friend?.failed || 0) + (outbox.data?.group?.failed || 0)}
            />
          </Card>
        </Col>
      </Row>
      <Card title="快捷链接">
        <Space wrap>
          {opsLinks().map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer">
              {name}
            </a>
          ))}
        </Space>
      </Card>
    </Space>
  );
}
