import { useQuery } from "@tanstack/react-query";
import { Button, Card, Descriptions, Space, Typography } from "antd";
import { getMe } from "../api/auth";
import { PageError } from "../components/PageError";

/**
 * 系统状态页只保留真实可观测的信号:管理端 API 是否可达 + 外部监控入口。
 * 原先的 friend/group outbox 队列面板读的是从未存在的 GET /outbox/health
 * (OpenIM 同步 outbox 早已拆除),只会显示一排 0 与「unknown」。
 */
export function SystemStatusPage() {
  const api = useQuery({ queryKey: ["apiReachable"], queryFn: getMe, retry: 0 });
  const refresh = () => {
    void api.refetch();
  };
  const links = [
    ["Grafana", import.meta.env.VITE_GRAFANA_URL],
    ["Sentry", import.meta.env.VITE_SENTRY_URL],
    ["Uptime Kuma", import.meta.env.VITE_UPTIME_KUMA_URL],
    ["Alertmanager", import.meta.env.VITE_ALERTMANAGER_URL],
  ].filter(([, url]) => !!url);

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Space className="page-title-row">
        <Typography.Title level={3}>系统状态</Typography.Title>
        <Button onClick={refresh}>刷新</Button>
      </Space>
      {api.isError ? (
        <PageError error={api.error} onRetry={refresh} message="系统状态加载失败" />
      ) : null}
      <Card loading={api.isLoading}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="API">{api.isError ? "不可达" : "可达"}</Descriptions.Item>
        </Descriptions>
      </Card>
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
