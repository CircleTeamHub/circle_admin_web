import { useQuery } from "@tanstack/react-query";
import { Button, Card, Descriptions, Space, Tag, Typography } from "antd";
import { getDashboard } from "../api/dashboard";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";

export function SystemStatusPage() {
  const query = useQuery({
    queryKey: ["system-dashboard"],
    queryFn: () => getDashboard("today"),
  });
  const system = query.data?.sections.system;
  const data = system?.status === "ok" ? system.data : null;
  const links = [
    ["Grafana", import.meta.env.VITE_GRAFANA_URL],
    ["Sentry", import.meta.env.VITE_SENTRY_URL],
    ["Uptime Kuma", import.meta.env.VITE_UPTIME_KUMA_URL],
    ["Alertmanager", import.meta.env.VITE_ALERTMANAGER_URL],
  ].filter(([, url]) => !!url);
  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <Space className="page-title-row">
        <Typography.Title level={3}>系统状态</Typography.Title>
        <Button loading={query.isFetching} onClick={() => void query.refetch()}>
          刷新
        </Button>
      </Space>
      {query.isError && (
        <PageError
          error={query.error}
          onRetry={() => query.refetch()}
          message="系统状态加载失败"
        />
      )}
      {system?.status === "error" && (
        <Typography.Text type="danger">
          系统指标暂时不可用，请刷新重试。
        </Typography.Text>
      )}
      <Typography.Text type="secondary">
        数据生成时间：
        {query.data ? formatDateTime(query.data.generatedAt) : "加载中"}
        ，指标可能缓存 45 秒。
      </Typography.Text>
      <Card title="服务状态" loading={query.isPending}>
        <Descriptions
          column={2}
          items={
            data
              ? Object.entries(data.services).map(([key, value]) => ({
                  key,
                  label:
                    (
                      {
                        api: "API",
                        database: "数据库",
                        redis: "Redis",
                      } as Record<string, string>
                    )[key] ?? key,
                  children: (
                    <Tag color={value === "healthy" ? "green" : "red"}>
                      {value === "healthy" ? "正常" : "异常"}
                    </Tag>
                  ),
                }))
              : []
          }
        />
      </Card>
      <Card title="外部监控">
        <Space wrap>
          {links.map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ))}
        </Space>
      </Card>
    </Space>
  );
}
