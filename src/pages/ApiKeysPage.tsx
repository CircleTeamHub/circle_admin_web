import { displayLabel } from "../utils/display";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { consoleApi, type Key } from "../api/console";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";
import { ReasonAction } from "./console-shared";
export function ApiKeysPage() {
  const visible = useRef(!document.hidden),
    mounted = useRef(true),
    issuing = useRef(false);
  const query = useQuery({
      queryKey: ["console", "keys"],
      queryFn: consoleApi.keys,
    }),
    client = useQueryClient();
  const [open, setOpen] = useState(false),
    [issued, setIssued] = useState<string | null>(null),
    [form] = Form.useForm();
  useEffect(() => {
    mounted.current = true;
    visible.current = !document.hidden;
    const clear = () => {
      visible.current = !document.hidden;
      if (document.hidden) setIssued(null);
    };
    document.addEventListener("visibilitychange", clear);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);
  const create = useMutation({
    mutationFn: async (body: unknown) => {
      const { secret, ...summary } = await consoleApi.createKey(body);
      if (mounted.current && visible.current) setIssued(secret);
      return summary;
    },
    onSuccess: () => {
      setOpen(false);
      form.resetFields();
      void client.invalidateQueries({ queryKey: ["console", "keys"] });
    },
  });
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <Space>
        <Typography.Title level={3}>自动化管理员密钥</Typography.Title>
        <Button
          type="primary"
          onClick={() => {
            create.reset();
            setOpen(true);
          }}
        >
          创建只读密钥
        </Button>
      </Space>
      <Alert
        type="info"
        title="密钥只显示一次，最长有效 30 天。仅可调用明确的只读工具接口；每次请求重新检查管理员状态、当前权限及密钥范围。撤销后立即失效。"
        description="不允许读取聊天正文、导出登录凭证、发送消息或执行资金及权限变更。"
      />
      {query.isError && <PageError error={query.error} />}
      <Card>
        <Table<Key>
          rowKey="id"
          dataSource={query.data?.items}
          loading={query.isFetching}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "名称", dataIndex: "name" },
            { title: "前缀", dataIndex: "prefix" },
            {
              title: "范围",
              dataIndex: "scopes",
              render: (v: string[]) =>
                v.map((value) => displayLabel("scope", value)).join("、"),
            },
            {
              title: "状态",
              render: (_, r) =>
                r.revokedAt
                  ? "已撤销"
                  : new Date(r.expiresAt) <= new Date()
                    ? "已过期"
                    : "有效",
            },
            {
              title: "最近使用",
              dataIndex: "lastUsedAt",
              render: formatDateTime,
            },
            {
              title: "过期时间",
              dataIndex: "expiresAt",
              render: formatDateTime,
            },
            {
              title: "操作",
              render: (_, r) =>
                !r.revokedAt ? (
                  <ReasonAction
                    title="撤销"
                    danger
                    path={`/admin/console/keys/${r.id}/revoke`}
                    payload={{}}
                  />
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Card>
      <Card title="工具接入">
        <Typography.Paragraph>
          在本机设置 CIRCLE_CONSOLE_URL 和 CIRCLE_CONSOLE_KEY，使用后端仓库
          scripts/console-read.mjs 调用 /api/v1/ops/read 下的只读接口。密钥使用
          Authorization 请求头传递，不放在 URL。
        </Typography.Paragraph>
        <Typography.Text code>
          node scripts/console-read.mjs tasks
        </Typography.Text>
      </Card>
      <Modal
        title="创建自动化密钥"
        open={open}
        onCancel={() => !create.isPending && setOpen(false)}
        onOk={async () => {
          if (issuing.current) return;
          issuing.current = true;
          try {
            await create.mutateAsync(await form.validateFields());
          } catch {
            /* Keep the form and error for a deliberate retry. */
          } finally {
            issuing.current = false;
          }
        }}
        confirmLoading={create.isPending}
        cancelButtonProps={{ disabled: create.isPending }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ days: 7, scopes: ["tasks"] }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, min: 2, max: 80 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="scopes"
            label="只读范围"
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={[
                "tasks",
                "push",
                "timeline",
                "analytics",
                "diagnostics",
              ].map((value) => ({
                value,
                label: displayLabel("scope", value),
              }))}
            />
          </Form.Item>
          <Form.Item name="days" label="有效天数" rules={[{ required: true }]}>
            <InputNumber min={1} max={30} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="创建原因"
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea />
          </Form.Item>
        </Form>
        {create.isError && (
          <>
            <PageError error={create.error} />
            <Typography.Paragraph>
              若响应丢失，请先刷新列表，撤销本次已创建的密钥后重新创建。
            </Typography.Paragraph>
          </>
        )}
      </Modal>
      <Modal
        title="立即保存密钥"
        open={!!issued}
        onCancel={() => setIssued(null)}
        onOk={() => setIssued(null)}
        okText="已保存并关闭"
      >
        <Alert
          type="warning"
          title="关闭或切到后台后无法再次查看；不要发送到聊天或提交到代码仓库。"
        />
        <Input.TextArea
          aria-label="新密钥"
          readOnly
          value={issued ?? ""}
          autoSize
        />
      </Modal>
    </Space>
  );
}
