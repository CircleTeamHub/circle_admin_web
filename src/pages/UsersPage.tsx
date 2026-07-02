import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { listUsers, updateUserStatus } from "../api/users";
import { PageError } from "../components/PageError";
import type { AdminUser, AuthUser, UserStatus } from "../types";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

const PAGE_SIZE = 20;

export function userListQueryString(params: {
  page: number;
  limit: number;
  accountId?: string;
  status?: UserStatus;
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  const accountId = params.accountId?.trim();
  if (accountId) search.set("accountId", accountId);
  if (params.status) search.set("status", params.status);
  return search.toString();
}

export function isDangerousSelfStatusChange(
  currentUserId: string,
  targetUserId: string,
  nextStatus: UserStatus,
) {
  return currentUserId === targetUserId && nextStatus !== "ACTIVE";
}

export function UsersPage({ currentUser }: { currentUser: AuthUser }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState<UserStatus | undefined>();
  const [modal, setModal] = useState<{
    user: AdminUser;
    nextStatus: UserStatus;
  } | null>(null);
  const [form] = Form.useForm<{ reason?: string }>();

  const query = userListQueryString({ page, limit: PAGE_SIZE, accountId, status });
  const users = useQuery({
    queryKey: ["users", query],
    queryFn: () => listUsers(query),
  });

  const mutation = useMutation({
    mutationFn: (payload: { user: AdminUser; nextStatus: UserStatus; reason?: string }) =>
      updateUserStatus(payload.user.id, payload.nextStatus, payload.reason),
    onSuccess: () => {
      message.success("用户状态已更新");
      setModal(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "用户状态更新失败"));
    },
  });

  const currentUserId = currentUser.userId || currentUser.id;
  const columns: ColumnsType<AdminUser> = [
    { title: "accountId", dataIndex: "accountId" },
    { title: "nickname", dataIndex: "nickname", render: (value) => value || "-" },
    { title: "role", dataIndex: "role", render: (value) => <Tag>{value}</Tag> },
    {
      title: "status",
      dataIndex: "status",
      render: (value: UserStatus) => (
        <Tag color={value === "ACTIVE" ? "green" : value === "BANNED" ? "red" : "default"}>
          {value}
        </Tag>
      ),
    },
    { title: "createdAt", dataIndex: "createdAt", render: (value) => formatDateTime(value) },
    { title: "lastOnline", dataIndex: "lastOnline", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            disabled={isDangerousSelfStatusChange(currentUserId, record.id, "BANNED")}
            onClick={() => setModal({ user: record, nextStatus: "BANNED" })}
          >
            封禁
          </Button>
          <Button size="small" onClick={() => setModal({ user: record, nextStatus: "ACTIVE" })}>
            解封
          </Button>
          <Button
            size="small"
            danger
            disabled={isDangerousSelfStatusChange(currentUserId, record.id, "DELETED")}
            onClick={() => setModal({ user: record, nextStatus: "DELETED" })}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Typography.Title level={3}>用户管理</Typography.Title>
      <Space wrap>
        <Input.Search
          allowClear
          placeholder="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          onSearch={() => setPage(1)}
          style={{ width: 240 }}
        />
        <Select<UserStatus>
          allowClear
          placeholder="status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          style={{ width: 180 }}
          options={["ACTIVE", "BANNED", "DELETED"].map((value) => ({ value, label: value }))}
        />
      </Space>
      {users.isError ? (
        <PageError error={users.error} onRetry={() => users.refetch()} message="用户列表加载失败" />
      ) : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users.data?.items || []}
        loading={users.isLoading}
        locale={{ emptyText: users.isError ? "加载失败" : "暂无用户" }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: users.data?.total || 0,
          onChange: setPage,
        }}
      />
      <Modal
        title={`确认将 ${modal?.user.accountId || ""} 改为 ${modal?.nextStatus || ""}`}
        open={!!modal}
        confirmLoading={mutation.isPending}
        okText="确认"
        cancelText="取消"
        onCancel={() => setModal(null)}
        onOk={async () => {
          if (!modal) return;
          const values = await form.validateFields();
          mutation.mutate({ user: modal.user, nextStatus: modal.nextStatus, reason: values.reason });
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label="操作说明"
            rules={[
              {
                required: modal?.nextStatus === "BANNED" || modal?.nextStatus === "DELETED",
                message: "封禁或删除必须填写说明",
              },
              { max: 500, message: "最多 500 字" },
            ]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
