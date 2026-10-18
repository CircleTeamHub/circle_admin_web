import { useEffect, useState } from "react";
import {
  auditActionLabel,
  auditEntityLabel,
  localDateTimeInput,
} from "./audit-presentation";
import { useSearchParams } from "react-router-dom";
import { useUrlValue } from "./use-url-value";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
} from "antd";
import {
  platformList,
  personLabel,
  type AuditLog,
  type ListQuery,
} from "../api/platform";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";

export function AuditLogsPage() {
  const [search, setSearch] = useSearchParams();
  const [form] = Form.useForm();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  useEffect(() => {
    form.setFieldsValue(
      Object.fromEntries(
        ["action", "actorID", "entityType", "entityID", "from", "to"].map(
          (key) => [
            key,
            key === "from" || key === "to"
              ? localDateTimeInput(search.get(key))
              : (search.get(key) ?? ""),
          ],
        ),
      ),
    );
  }, [form, search]);
  const filters: ListQuery = Object.fromEntries(
    ["action", "actorID", "entityType", "entityID", "from", "to"].flatMap(
      (key) => (search.get(key) ? [[key, search.get(key)!]] : []),
    ),
  );
  const [page, setPage] = useUrlValue<number>("page", 1);
  const setFilters = (values: ListQuery) =>
    setSearch(
      () =>
        new URLSearchParams(
          Object.entries(values)
            .filter(([, v]) => !!v)
            .map(([k, v]) => [k, String(v)]),
        ),
    );
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
      <Typography.Title level={3}>管理员操作记录</Typography.Title>
      <Typography.Paragraph type="secondary">
        记录正常管理操作及登录、退出记录；失败记录统一在“问题排查”查看。点击详情可查看完整编号，空白信息表示当时未记录。
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "12px 16px",
          padding: 16,
          background: "#fff",
          borderRadius: 8,
        }}
        initialValues={Object.fromEntries(
          Object.entries(filters).map(([k, v]) => [
            k,
            k === "from" || k === "to" ? localDateTimeInput(v) : v,
          ]),
        )}
        onFinish={(values) => {
          const result = { ...values };
          for (const field of ["from", "to"])
            if (result[field])
              result[field] = new Date(result[field]).toISOString();
          setFilters(result);
        }}
      >
        {["action", "actorID", "entityType", "entityID"].map((name, i) => (
          <Form.Item
            key={name}
            name={name}
            label={["操作", "操作人 ID", "对象类型", "对象 ID"][i]}
          >
            <Input
              allowClear
              placeholder={
                [
                  "如 admin.login.success",
                  "输入操作人 ID",
                  "如 User、CircleMember",
                  "输入对象 ID",
                ][i]
              }
              maxLength={name === "action" ? 80 : 64}
            />
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
        <Space style={{ alignSelf: "end", marginBottom: 24 }}>
          <Button htmlType="submit" type="primary">
            查询
          </Button>
          <Button
            onClick={() => {
              form.resetFields();
              setSearch(new URLSearchParams());
            }}
          >
            重置
          </Button>
        </Space>
      </Form>
      {query.error && (
        <PageError error={query.error} onRetry={() => void query.refetch()} />
      )}
      <Table<AuditLog>
        rowKey="id"
        loading={query.isFetching}
        dataSource={query.data?.items ?? []}
        tableLayout="fixed"
        scroll={{ x: 1180 }}
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
            width: 160,
            ellipsis: true,
            render: (_, row) =>
              row.operator
                ? personLabel(row.operator)
                : row.actorAccountId || row.actorID || "未记录操作人",
          },
          {
            title: "做了什么",
            width: 210,
            render: (_, row) => (
              <Space
                orientation="vertical"
                size={2}
                style={{ maxWidth: "100%" }}
              >
                <span>{auditActionLabel(row.action)}</span>
                <Typography.Text
                  type="secondary"
                  ellipsis={{ tooltip: row.action }}
                  style={{ fontSize: 12, maxWidth: 180 }}
                >
                  {row.action}
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: "操作对象",
            width: 180,
            render: (_, row) => (
              <Space orientation="vertical" size={2}>
                <span title={row.entityType}>
                  {auditEntityLabel(row.entityType)}
                </span>
                {row.entityID && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setSelected(row)}
                  >
                    对象详情
                  </Button>
                )}
              </Space>
            ),
          },
          {
            title: "操作原因",
            width: 180,
            ellipsis: true,
            render: (_, row) => row.reason || "—",
          },
          {
            title: "时间",
            width: 160,
            dataIndex: "createdAt",
            render: formatDateTime,
          },
          {
            title: "请求 ID",
            width: 150,
            render: (_, row) =>
              row.requestId ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setSelected(row)}
                >
                  诊断详情
                </Button>
              ) : (
                "—"
              ),
          },
          {
            title: "详情",
            width: 80,
            render: (_, row) => (
              <Button type="link" onClick={() => setSelected(row)}>
                查看
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title="审计日志详情"
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={720}
      >
        {selected && (
          <Descriptions
            column={1}
            bordered
            size="small"
            items={[
              {
                key: "action",
                label: "操作",
                children: auditActionLabel(selected.action),
              },
              {
                key: "code",
                label: "操作代码",
                children: (
                  <Typography.Text copyable>{selected.action}</Typography.Text>
                ),
              },
              {
                key: "actor",
                label: "操作人",
                children: selected.operator
                  ? personLabel(selected.operator)
                  : selected.actorAccountId || "未记录",
              },
              {
                key: "actorID",
                label: "操作人 ID",
                children: (
                  <Typography.Text copyable>{selected.actorID}</Typography.Text>
                ),
              },
              {
                key: "type",
                label: "对象类型",
                children: `${auditEntityLabel(selected.entityType)}（${selected.entityType || "—"}）`,
              },
              {
                key: "id",
                label: "对象 ID",
                children: selected.entityID ? (
                  <Typography.Text copyable>
                    {selected.entityID}
                  </Typography.Text>
                ) : (
                  "未记录"
                ),
              },
              {
                key: "reason",
                label: "操作原因",
                children: selected.reason || "未记录",
              },
              {
                key: "time",
                label: "时间",
                children: formatDateTime(selected.createdAt),
              },
              {
                key: "request",
                label: "请求 ID",
                children: selected.requestId ? (
                  <Typography.Text copyable>
                    {selected.requestId}
                  </Typography.Text>
                ) : (
                  "未记录"
                ),
              },
            ]}
          />
        )}
      </Modal>
    </Space>
  );
}
