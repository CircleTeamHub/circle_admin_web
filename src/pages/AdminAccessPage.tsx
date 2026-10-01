import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { getMe } from "../api/auth";
import { ApiError } from "../api/client";
import {
  getPlatformAccess,
  platformList,
  platformWrite,
  type AdminAccount,
  type ConsoleRole,
} from "../api/platform";
import { PageError } from "../components/PageError";

const roles: ConsoleRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "MODERATOR",
  "SUPPORT",
];
const abilities =
  "SUPER_ADMIN：全部权限；OPERATIONS：仪表盘、用户查看、社群、商务、内容；MODERATOR：仪表盘、用户查看与处置、社群、IM 查看与处置、审核、审计；SUPPORT：用户查看、IM 查看、客服、充值。";
export function AdminAccessPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [conflict, setConflict] = useState(false);
  const [form] = Form.useForm();
  const me = useQuery({ queryKey: ["auth-me"], queryFn: getMe });
  const access = useQuery({
    queryKey: ["platform-access-me"],
    queryFn: getPlatformAccess,
  });
  const list = useQuery({
    queryKey: ["admin-access-accounts", search, page],
    queryFn: () =>
      platformList<AdminAccount>("/admin/access/accounts", {
        search,
        page,
        limit: 20,
      }),
  });
  async function save(values: { role: ConsoleRole; reason: string }) {
    if (!selected || busy || conflict) return;
    Modal.confirm({
      title: "确认分配管理员权限",
      content: `${selected.accountId} → ${values.role}；原因：${values.reason}`,
      onOk: async () => {
        setBusy(true);
        setError(undefined);
        try {
          await platformWrite(
            `/admin/access/accounts/${selected.id}`,
            "PATCH",
            {
              ...values,
              reason: values.reason.trim(),
              version: selected.version,
            },
          );
          setSelected(null);
          await list.refetch();
        } catch (e) {
          setError(e);
          setConflict(e instanceof ApiError && e.status === 409);
        } finally {
          setBusy(false);
        }
      },
    });
  }
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Title level={3}>管理员权限</Typography.Title>
      <Alert
        type="info"
        message={abilities}
        description="迁移时已有 ACTIVE 管理员被初始化为 SUPER_ADMIN。未分配账号需要超级管理员授权。"
      />
      <Typography.Text>
        当前角色：{access.data?.role ?? "加载中"}
      </Typography.Text>
      {(me.error || access.error) && (
        <PageError
          error={me.error || access.error}
          onRetry={() => {
            void me.refetch();
            void access.refetch();
          }}
        />
      )}
      <Input.Search
        maxLength={64}
        placeholder="账号 / 昵称"
        allowClear
        onSearch={(value) => {
          setSearch(value.trim());
          setPage(1);
        }}
        style={{ maxWidth: 400 }}
      />
      {list.error && (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      )}
      <Table<AdminAccount>
        rowKey="id"
        dataSource={list.data?.items ?? []}
        loading={list.isFetching}
        pagination={{
          current: page,
          pageSize: 20,
          total: Math.min(list.data?.total ?? 0, 10000),
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          { title: "账号", dataIndex: "accountId" },
          { title: "昵称", dataIndex: "nickname" },
          { title: "状态", dataIndex: "status" },
          { title: "角色", render: (_, r) => r.consoleRole || "未分配" },
          { title: "版本", dataIndex: "version" },
          {
            title: "操作",
            render: (_, row) => (
              <Button
                disabled={
                  !me.data ||
                  access.data?.role !== "SUPER_ADMIN" ||
                  row.status !== "ACTIVE" ||
                  row.id === (me.data.userId || me.data.id)
                }
                onClick={() => {
                  setSelected(row);
                  setError(undefined);
                  setConflict(false);
                  form.resetFields();
                  form.setFieldsValue({ role: row.consoleRole || undefined });
                }}
              >
                分配角色
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title="分配管理员角色"
        open={!!selected}
        confirmLoading={busy}
        okButtonProps={{ disabled: conflict }}
        onOk={() => form.submit()}
        onCancel={() => {
          if (!busy) setSelected(null);
        }}
      >
        {!!error && <PageError error={error} />}
        {conflict && (
          <Button
            onClick={async () => {
              const result = await list.refetch();
              const row = result.data?.items.find((r) => r.id === selected?.id);
              if (row) {
                setSelected(row);
                setConflict(false);
                setError(undefined);
              }
            }}
          >
            刷新目标版本后重新确认
          </Button>
        )}
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roles.map((value) => ({ value, label: value }))} />
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
