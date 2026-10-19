import { PageHeader } from "../components/PageHeader";
import { displayLabel } from "../utils/display";
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
    ["监控看板（Grafana）", import.meta.env.VITE_GRAFANA_URL],
    ["错误追踪（Sentry）", import.meta.env.VITE_SENTRY_URL],
    ["可用性监控（Uptime Kuma）", import.meta.env.VITE_UPTIME_KUMA_URL],
    ["告警管理（Alertmanager）", import.meta.env.VITE_ALERTMANAGER_URL],
  ].filter(([, url]) => !!url);
  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <Space className="page-title-row">
        <PageHeader title="系统状态" description="检查后台服务与依赖是否正常，遇到异常时查看监控。" />
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
                        api: "接口服务",
                        database: "数据库",
                        redis: "缓存服务",
                      } as Record<string, string>
                    )[key] ?? key,
                  children: (
                    <Tag
                      color={
                        value === "healthy"
                          ? "green"
                          : value === "down"
                            ? "red"
                            : "default"
                      }
                    >
                      {displayLabel("health", value)}
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
