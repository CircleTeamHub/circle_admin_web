import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Typography,
} from "antd";
import { ApiError } from "../api/client";
import {
  platformList,
  platformWrite,
  publicHttps,
  type Advertisement,
  type AdvertisementInput,
} from "../api/platform";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";

function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
function phase(row: Advertisement) {
  if (!row.enabled) return "草稿 / 停用";
  if (Date.parse(row.endsAt) <= Date.now()) return "已过期";
  return Date.parse(row.startsAt) > Date.now() ? "已排期" : "展示中";
}
export function AdsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Advertisement | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [form] = Form.useForm();
  const operation = useRef({ key: "", payload: "" });
  const list = useQuery({
    queryKey: ["advertisements", page, search],
    queryFn: () =>
      platformList<Advertisement>("/admin/operations/advertisements", {
        page,
        limit: 20,
        search,
      }),
  });
  function open(row: Advertisement | "new") {
    setEditing(row);
    setError(undefined);
    setConflict(false);
    setPreview(undefined);
    form.resetFields();
    operation.current = { key: crypto.randomUUID(), payload: "" };
    form.setFieldsValue(
      row === "new"
        ? { enabled: false, sortOrder: 0 }
        : {
            ...row,
            startsAt: localInput(row.startsAt),
            endsAt: localInput(row.endsAt),
          },
    );
  }
  function save(values: AdvertisementInput) {
    if (!editing || busy || conflict) return;
    const payload = {
      ...values,
      title: values.title.trim(),
      imageUrl: values.imageUrl.trim(),
      targetUrl: values.targetUrl.trim(),
      reason: values.reason.trim(),
      placement: "CIRCLE_HOME" as const,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      ...(editing === "new" ? {} : { version: editing.version }),
    };
    Modal.confirm({
      title: payload.enabled ? "确认发布 / 更新广告" : "确认保存停用广告",
      content: `${payload.title}；${payload.startsAt} 至 ${payload.endsAt}；原因：${payload.reason}`,
      onOk: async () => {
        setBusy(true);
        setError(undefined);
        try {
          const serialized = JSON.stringify(payload);
          if (
            operation.current.payload &&
            operation.current.payload !== serialized
          )
            operation.current.key = crypto.randomUUID();
          operation.current.payload = serialized;
          await platformWrite(
            `/admin/operations/advertisements${editing === "new" ? "" : `/${editing.id}`}`,
            editing === "new" ? "POST" : "PATCH",
            payload,
            editing === "new" ? operation.current.key : undefined,
          );
          setEditing(null);
          setPreview(undefined);
          await list.refetch();
        } catch (e) {
          setError(e);
          setConflict(
            editing !== "new" && e instanceof ApiError && e.status === 409,
          );
        } finally {
          setBusy(false);
        }
      },
    });
  }
  const urlRules = [
    { required: true },
    {
      validator: (_: unknown, value: string) =>
        !value || publicHttps(value.trim())
          ? Promise.resolve()
          : Promise.reject(new Error("请输入无凭据的公开 HTTPS 链接")),
    },
  ];
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Title level={3}>广告管理</Typography.Title>
      <Alert
        type="info"
        message="圈子首页广告；停用或设置结束时间以归档。预览会向图片地址发起请求。"
      />
      <Space>
        <Input.Search
          maxLength={64}
          allowClear
          placeholder="标题"
          onSearch={(v) => {
            setSearch(v.trim());
            setPage(1);
          }}
        />
        <Button type="primary" onClick={() => open("new")}>
          新建广告
        </Button>
      </Space>
      {list.error && (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      )}
      <Table<Advertisement>
        rowKey="id"
        loading={list.isFetching}
        dataSource={list.data?.items ?? []}
        scroll={{ x: 950 }}
        pagination={{
          current: page,
          pageSize: 20,
          total: Math.min(list.data?.total ?? 0, 10000),
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          { title: "标题", dataIndex: "title" },
          { title: "状态", render: (_, r) => phase(r) },
          { title: "启用", render: (_, r) => (r.enabled ? "是" : "否") },
          { title: "排序", dataIndex: "sortOrder" },
          { title: "开始", dataIndex: "startsAt", render: formatDateTime },
          { title: "结束", dataIndex: "endsAt", render: formatDateTime },
          {
            title: "操作",
            render: (_, r) => (
              <Button onClick={() => open(r)}>编辑 / 启停</Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!editing}
        title="广告配置"
        confirmLoading={busy}
        okButtonProps={{ disabled: conflict }}
        onCancel={() => {
          if (!busy) {
            setEditing(null);
            setPreview(undefined);
          }
        }}
        onOk={() => form.submit()}
      >
        {!!error && <PageError error={error} />}
        {conflict && editing !== "new" && (
          <Button
            onClick={async () => {
              const result = await list.refetch();
              const row = result.data?.items.find((r) => r.id === editing?.id);
              if (row) {
                setEditing(row);
                setConflict(false);
                setError(undefined);
              }
            }}
          >
            刷新版本后重新确认
          </Button>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={save}
          onValuesChange={() => setPreview(undefined)}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, whitespace: true, max: 80 }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片 HTTPS 地址" rules={urlRules}>
            <Input maxLength={2048} />
          </Form.Item>
          <Button
            onClick={async () => {
              try {
                await form.validateFields(["imageUrl"]);
                setPreview(form.getFieldValue("imageUrl").trim());
              } catch {
                /* field displays validation */
              }
            }}
          >
            预览图片
          </Button>
          {preview && (
            <img
              src={preview}
              alt="广告图片预览"
              referrerPolicy="no-referrer"
              style={{ maxWidth: "100%", maxHeight: 240 }}
            />
          )}
          <Form.Item name="targetUrl" label="目标 HTTPS 地址" rules={urlRules}>
            <Input maxLength={2048} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" rules={[{ required: true }]}>
            <InputNumber min={0} max={10000} precision={0} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="startsAt"
            label="开始时间"
            rules={[{ required: true }]}
          >
            <Input type="datetime-local" step={1} />
          </Form.Item>
          <Form.Item
            name="endsAt"
            label="结束时间"
            dependencies={["startsAt"]}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value ||
                    !getFieldValue("startsAt") ||
                    new Date(value) > new Date(getFieldValue("startsAt"))
                    ? Promise.resolve()
                    : Promise.reject(new Error("结束时间必须晚于开始时间"));
                },
              }),
            ]}
          >
            <Input type="datetime-local" step={1} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="原因"
            rules={[{ required: true, whitespace: true, min: 2, max: 500 }]}
          >
            <Input.TextArea maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
