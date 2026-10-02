import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Form, Input, Space, Table, Typography } from "antd";
import {
  platformList,
  personLabel,
  type AuditLog,
  type ListQuery,
} from "../api/platform";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";

export function AuditLogsPage() {
  const [filters, setFilters] = useState<ListQuery>({});
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["audit-logs", filters, page],
    queryFn: () =>
      platformList<AuditLog>("/admin/operations/audit-logs", {
        ...filters,
        page,
        limit: 20,
      }),
  });
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Title level={3}>审计日志</Typography.Title>
      <Form
        layout="inline"
        onFinish={(values) => {
          const result = { ...values };
          for (const field of ["from", "to"])
            if (result[field])
              result[field] = new Date(result[field]).toISOString();
          setFilters(result);
          setPage(1);
        }}
      >
        {["action", "actorID", "entityType", "entityID"].map((name, i) => (
          <Form.Item
            key={name}
            name={name}
            label={["操作", "操作人 ID", "对象类型", "对象 ID"][i]}
          >
            <Input maxLength={name === "action" ? 80 : 64} />
          </Form.Item>
        ))}
        <Form.Item name="from" label="开始">
          <Input type="datetime-local" />
        </Form.Item>
        <Form.Item
          name="to"
          label="结束"
          dependencies={["from"]}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value ||
                  !getFieldValue("from") ||
                  new Date(value) >= new Date(getFieldValue("from"))
                  ? Promise.resolve()
                  : Promise.reject(new Error("结束时间不能早于开始时间"));
              },
            }),
          ]}
        >
          <Input type="datetime-local" />
        </Form.Item>
        <Button htmlType="submit" type="primary">
          查询
        </Button>
      </Form>
      {query.error && (
        <PageError error={query.error} onRetry={() => void query.refetch()} />
      )}
      <Table<AuditLog>
        rowKey="id"
        loading={query.isFetching}
        dataSource={query.data?.items ?? []}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize: 20,
          total: Math.min(query.data?.total ?? 0, 10000),
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "操作人",
            render: (_, row) =>
              row.operator
                ? personLabel(row.operator)
                : row.actorAccountId || row.actorID,
          },
          { title: "操作", dataIndex: "action" },
          {
            title: "对象",
            render: (_, row) => `${row.entityType}: ${row.entityID || "—"}`,
          },
          { title: "原因", dataIndex: "reason" },
          { title: "时间", dataIndex: "createdAt", render: formatDateTime },
          { title: "请求 ID", dataIndex: "requestId" },
        ]}
      />
    </Space>
  );
}
