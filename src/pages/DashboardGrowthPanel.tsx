import { CodeValue } from "../components/ReadableValue";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import { consoleApi } from "../api/console";
import { formatDateTime } from "../utils/format";
import { PageError } from "../components/PageError";
import { CollectionNotice, useConsoleFilters } from "./console-shared";
export function DashboardGrowthPanel() {
  const { search, set } = useConsoleFilters();
  const requested = Number(search.get("days") ?? 30),
    days = [7, 30, 90].includes(requested) ? requested : 30;
  const query = useQuery({
    queryKey: ["console", "analytics", days],
    queryFn: () => consoleApi.analytics(days),
  });
  const data = query.data,
    funnel = data?.funnel;
  const steps = funnel
    ? ([
        ["注册", funnel.registered],
        ["使用过 App", funnel.opened],
        ["加入圈子", funnel.joined],
        ["发送消息", funnel.messaged],
      ] as const)
    : [];
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <Space>
        <Typography.Title level={4} style={{ margin: 0 }}>
          用户使用情况
        </Typography.Title>
        <Select
          aria-label="分析时间范围"
          value={days}
          onChange={(v) => set({ days: String(v) })}
          options={[7, 30, 90].map((value) => ({
            value,
            label: `最近 ${value} 天`,
          }))}
        />
      </Space>
      <Typography.Paragraph type="secondary">
        查看新用户注册后做了什么、之后有没有回来，以及各项功能用了多少次。这里的统计天数可以单独选择。
      </Typography.Paragraph>
      <Button onClick={() => void query.refetch()} loading={query.isFetching}>
        刷新分析
      </Button>
      <Typography.Text type="secondary">
        统计生成时间：{data ? formatDateTime(data.generatedAt) : "加载中"}
        ，结果最多延迟 45 秒更新。
      </Typography.Text>
      <CollectionNotice startedAt={data?.collectionStartedAt} />
      {query.isError && (
        <PageError error={query.error} onRetry={() => void query.refetch()} />
      )}
      <Card title="新用户注册后，有多少人开始聊天" loading={query.isPending}>
        <Row gutter={16}>
          {steps.map(([label, value], index) => (
            <Col span={6} key={label}>
              <Statistic title={label} value={value} />
              <Typography.Text type="secondary">
                {index === 0
                  ? "注册人数"
                  : steps[index - 1][1] ? `上一步用户中有 ${((value / steps[index - 1][1]) * 100).toFixed(1)}% 完成这一步` : "暂无可比较的人数"}
              </Typography.Text>
            </Col>
          ))}
        </Row>
        <Typography.Paragraph type="secondary">
          按先后顺序统计：注册后的7天内，先使用
          App、再加入圈子、最后发送消息的人数。
        </Typography.Paragraph>
      </Card>
      <Card title="注册后还有多少人回来使用">
        <Table
          rowKey="day"
          loading={query.isFetching}
          dataSource={data?.retention}
          pagination={false}
          columns={[
            {
              title: "注册后第几天",
              dataIndex: "day",
              render: (v: number) => `第 ${v} 天`,
            },
            { title: "已到这一天的注册用户", dataIndex: "eligible" },
            { title: "这天回来使用的人", dataIndex: "returned" },
            {
              title: "回来使用的比例",
              render: (_, r) =>
                r.eligible
                  ? `${((r.returned / r.eligible) * 100).toFixed(1)}%`
                  : "还没到统计日期，或暂无用户",
            },
          ]}
        />
        <Typography.Paragraph type="secondary">
          例如“第7天”：只统计注册已满7天的用户，看他们第7天当天是否回来使用。
        </Typography.Paragraph>
      </Card>
      <Card title="每天有多少人在使用">
        <Table
          rowKey="day"
          dataSource={data?.daily}
          pagination={{ pageSize: 15 }}
          columns={[
            { title: "日期", dataIndex: "day" },
            { title: "使用人数", dataIndex: "users" },
            { title: "操作次数", dataIndex: "events" },
          ]}
        />
        <Typography.Paragraph type="secondary">
          同一天内打开
          App、发消息、创建笔记、发布动态或提交举报的用户只算1人；收到通知不算主动使用。按北京时间统计。
        </Typography.Paragraph>
      </Card>
      <Card title="各项功能用了多少次">
        <Table
          rowKey={(r) => `${r.source}:${r.name}`}
          dataSource={data?.features}
          pagination={false}
          columns={[
            {
              title: "功能",
              dataIndex: "name",
              render: (s: string) => <CodeValue domain="event" value={s} />,
            },
            {
              title: "来源",
              dataIndex: "source",
              render: (value: string | null) => (
                <CodeValue domain="source" value={value} />
              ),
            },
            { title: "使用人数", dataIndex: "users" },
            { title: "发生次数", dataIndex: "events" },
          ]}
        />
      </Card>
      <Alert
        type="info"
        title="这些记录帮助了解用户的使用情况，不能用来判断付款是否成功，也不能用来决定用户权限。"
      />
    </Space>
  );
}
