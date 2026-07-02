import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, Space, Typography } from "antd";
import { getMe } from "../api/auth";
import { getOutboxHealth } from "../api/system";
import type { OutboxQueueHealth } from "../types";

function QueueHealth({ title, data }: { title: string; data?: OutboxQueueHealth }) {
  return (
    <Card title={title}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="pending">{data?.pending ?? 0}</Descriptions.Item>
        <Descriptions.Item label="processing">{data?.processing ?? 0}</Descriptions.Item>
        <Descriptions.Item label="failed">{data?.failed ?? 0}</Descriptions.Item>
        <Descriptions.Item label="oldest pending">{data?.oldestPendingAt || "-"}</Descriptions.Item>
        <Descriptions.Item label="oldest failed">{data?.oldestFailedAt || "-"}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export function SystemStatusPage() {
  const outbox = useQuery({ queryKey: ["outboxHealth"], queryFn: getOutboxHealth });
  const api = useQuery({ queryKey: ["apiReachable"], queryFn: getMe, retry: 0 });
  const links = [
    ["Grafana", import.meta.env.VITE_GRAFANA_URL],
    ["Sentry", import.meta.env.VITE_SENTRY_URL],
    ["Uptime Kuma", import.meta.env.VITE_UPTIME_KUMA_URL],
    ["Alertmanager", import.meta.env.VITE_ALERTMANAGER_URL],
  ].filter(([, url]) => !!url);

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Typography.Title level={3}>系统状态</Typography.Title>
      <Card>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="API">{api.isError ? "不可达" : "可达"}</Descriptions.Item>
          <Descriptions.Item label="Outbox">{outbox.data?.status || "unknown"}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Space align="start" wrap>
        <QueueHealth title="friend outbox" data={outbox.data?.friend} />
        <QueueHealth title="group outbox" data={outbox.data?.group} />
      </Space>
      <Card title="外部系统">
        <Space wrap>
          {links.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer">
              {name}
            </a>
          ))}
        </Space>
      </Card>
    </Space>
  );
}
