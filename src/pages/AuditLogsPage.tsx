import { ReloadOutlined } from "@ant-design/icons";
import { Identifier } from "../components/ReadableValue";
import { PageHeader } from "../components/PageHeader";
import { useEffect, useState } from "react";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ENTITY_LABEL,
  auditActionLabel,
  auditEntityLabel,
  localDateTimeInput,
} from "./audit-presentation";
import { useSearchParams } from "react-router-dom";
import { useUrlValue } from "./use-url-value";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Collapse,
  Select,
  Tag,
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
  const actionOptions = Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label }));
  if (search.get("action") && !AUDIT_ACTION_LABEL[search.get("action")!]) {
    actionOptions.push({ value: search.get("action")!, label: `其他操作（${search.get("action")}）` });
  }
  const entityOptions = Object.entries(AUDIT_ENTITY_LABEL).map(([value, label]) => ({ value, label: Object.values(AUDIT_ENTITY_LABEL).filter((text) => text === label).length > 1 ? `${label}（${value}）` : label }));
  if (search.get("entityType") && !AUDIT_ENTITY_LABEL[search.get("entityType")!]) {
    entityOptions.push({ value: search.get("entityType")!, label: "其他对象" });
  }
  const advancedActive = Boolean(search.get("actorID") || search.get("entityID") || search.get("entityType"));
  const operatorName = (row: AuditLog) => row.operator ? personLabel(row.operator) : row.actorAccountId || "未记录操作人";
  return (
    <Space orientation="vertical" size={20} className="page-stack audit-logs-page">
      <PageHeader
        title="管理员操作记录"
        description="查看谁在什么时候做了什么。失败请求请到「问题排查」查看。"
        extra={<Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>刷新记录</Button>}
      />
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, key === "from" || key === "to" ? localDateTimeInput(value) : value]))}
          onFinish={(values) => {
            const result = { ...values };
            for (const field of ["from", "to"])
              if (result[field]) result[field] = new Date(result[field]).toISOString();
            for (const key of Object.keys(result))
              if (typeof result[key] === "string") result[key] = result[key].trim();
            setFilters(result);
          }}
        >
          <div className="audit-filter-grid">
            <Form.Item name="action" label="操作类型">
              <Select allowClear showSearch optionFilterProp="label" placeholder="全部操作" options={actionOptions} />
            </Form.Item>
            <Form.Item name="from" label="开始时间"><Input type="datetime-local" /></Form.Item>
            <Form.Item name="to" label="结束时间" dependencies={["from"]} rules={[
              ({ getFieldValue }) => ({ validator(_, value) {
                return !value || !getFieldValue("from") || new Date(value) >= new Date(getFieldValue("from"))
                  ? Promise.resolve() : Promise.reject(new Error("结束时间不能早于开始时间"));
              } }),
            ]}><Input type="datetime-local" /></Form.Item>
          </div>
          <div className="audit-filter-footer">
            <Collapse ghost className="audit-advanced-filters" defaultActiveKey={advancedActive ? ["ids"] : []} items={[{
              key: "ids", label: <Space>高级筛选{advancedActive && <Tag color="blue">已启用</Tag>}</Space>, forceRender: true,
              children: <div className="audit-filter-grid audit-id-filters">
                <Form.Item name="entityType" label="原始对象类型"><Select allowClear showSearch optionFilterProp="label" placeholder="全部对象类型（技术排查使用）" options={entityOptions} /></Form.Item>
                <Form.Item name="actorID" label="操作人编号"><Input allowClear placeholder="粘贴操作人的内部编号" maxLength={64} /></Form.Item>
                <Form.Item name="entityID" label="对象编号"><Input allowClear placeholder="粘贴操作对象的内部编号" maxLength={64} /></Form.Item>
              </div>,
            }]} />
            <Space className="audit-filter-actions">
              <Button htmlType="submit" type="primary">查询</Button>
              <Button onClick={() => { form.resetFields(); setSearch(new URLSearchParams()); }}>重置</Button>
            </Space>
          </div>
        </Form>
      </Card>
      {query.isError && <PageError error={query.error} onRetry={() => void query.refetch()} message="操作记录加载失败" />}
      <Card title="操作记录" extra={<Typography.Text type="secondary">点击「查看详情」查看完整记录</Typography.Text>}>
        <Table<AuditLog>
          rowKey="id" loading={query.isFetching} dataSource={query.data?.items ?? []}
          tableLayout="fixed" scroll={{ x: 980 }}
          locale={{ emptyText: "没有符合条件的操作记录，请调整筛选条件。" }}
          pagination={{ current: page, pageSize: 20, total: Math.min(query.data?.total ?? 0, 10000), showSizeChanger: false, onChange: setPage, hideOnSinglePage: true, showTotal: (total) => `共 ${total} 条记录` }}
          columns={[
            { title: "时间", width: 170, dataIndex: "createdAt", render: formatDateTime },
            { title: "操作人", width: 160, ellipsis: true, render: (_, row) => operatorName(row) },
            { title: "操作内容", width: 220, render: (_, row) => <Typography.Text strong>{auditActionLabel(row.action)}</Typography.Text> },
            { title: "操作对象", width: 130, render: (_, row) => auditEntityLabel(row.entityType) },
            { title: "操作原因", width: 200, ellipsis: true, render: (_, row) => row.reason || <Typography.Text type="secondary">未记录</Typography.Text> },
            { title: "操作", width: 100, fixed: "right", render: (_, row) => <Button type="link" onClick={() => setSelected(row)}>查看详情</Button> },
          ]}
        />
        {(query.data?.total ?? 0) > 10000 && <Typography.Text type="secondary">最多展示 10000 条记录，请缩小时间范围后查询。</Typography.Text>}
      </Card>
      <Modal
        title="操作详情" open={!!selected} onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>关闭</Button>} width={760} centered destroyOnHidden
      >
        {selected && <Space orientation="vertical" size={20} className="page-stack audit-detail">
          <div className="audit-detail-summary">
            <Typography.Title level={4}>{auditActionLabel(selected.action)}</Typography.Title>
            <Space wrap size={12}><Tag>{auditEntityLabel(selected.entityType)}</Tag><Typography.Text type="secondary">{formatDateTime(selected.createdAt)}</Typography.Text></Space>
          </div>
          <Descriptions column={1} items={[
            { key: "actor", label: "操作人", children: operatorName(selected) },
            { key: "target", label: "操作对象", children: auditEntityLabel(selected.entityType) },
            { key: "reason", label: "操作原因", children: <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selected.reason || "未记录操作原因"}</span> },
          ]} />
          <Collapse items={[{
            key: "technical", label: "内部编号与操作代码（排查使用）",
            children: <Space orientation="vertical" size={12} className="page-stack">
              <Typography.Text type="secondary">联系技术人员排查时，可复制下方编号。日常查看无需关注。</Typography.Text>
              <Descriptions column={1} size="small" items={[
                { key: "record", label: "操作记录编号", children: <Identifier value={selected.id} inline /> },
                { key: "action", label: "操作代码", children: <Typography.Text code copyable>{selected.action}</Typography.Text> },
                { key: "actor", label: "操作人编号", children: <Identifier value={selected.actorID} inline /> },
                { key: "entity", label: "对象编号", children: selected.entityID ? <Identifier value={selected.entityID} inline /> : "未记录" },
                { key: "type", label: "原始对象类型", children: selected.entityType || "未记录" },
                { key: "request", label: "排查编号", children: selected.requestId ? <Identifier value={selected.requestId} inline /> : "未记录" },
              ]} />
            </Space>,
          }]} />
        </Space>}
      </Modal>
    </Space>
  );
}
