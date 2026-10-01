import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import {
  grantMembership,
  listMembers,
  listPlans,
  listMembershipGrants,
  type Member,
} from "../api/admin-commerce";
import { formatDateTime } from "../utils/format";
import { getErrorMessage } from "../utils/errors";
import { useSearchParams } from "react-router-dom";
export function MembershipsPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [level, setLevel] = useState<number>();
  const [expiry, setExpiry] = useState<string>();
  const [cursor, setCursor] = useState<string>();
  const [target, setTarget] = useState<Member>();
  const [grantLevel, setGrantLevel] = useState(1);
  const [note, setNote] = useState("");
  const key = useRef("");
  const members = useQuery({
    queryKey: ["memberships", search, level, expiry, cursor],
    queryFn: () => listMembers({ search, level, expiry, cursor }),
  });
  const plans = useQuery({ queryKey: ["membershipPlans"], queryFn: listPlans });
  const [historyUser, setHistoryUser] = useState<Member>();
  const [historyCursor, setHistoryCursor] = useState<string>();
  const history = useQuery({
    queryKey: ["membershipHistory", historyUser?.id, historyCursor],
    queryFn: () => listMembershipGrants(historyUser!.id, historyCursor),
    enabled: !!historyUser,
  });
  const mutation = useMutation({
    mutationFn: () =>
      grantMembership(target!.id, {
        targetLevel: grantLevel,
        idempotencyKey: key.current,
        note: note.trim(),
      }),
    retry: false,
    onSuccess: () => {
      setTarget(undefined);
      void qc.invalidateQueries({ queryKey: ["memberships"] });
      message.success("会员授权成功");
    },
    onError: (e) => message.error(getErrorMessage(e, "授权失败，表单已保留")),
  });
  return (
    <Space orientation="vertical" className="page-stack">
      <Typography.Title level={3}>会员管理</Typography.Title>
      <Space wrap>
        <Input.Search
          placeholder="账号或昵称"
          maxLength={64}
          onSearch={(v) => {
            setSearch(v);
            setCursor(undefined);
          }}
        />
        <Select
          allowClear
          placeholder="等级"
          style={{ width: 140 }}
          options={[
            { value: 0, label: "普通用户" },
            ...(plans.data ?? []).map((p) => ({
              value: p.level,
              label: p.key,
            })),
          ]}
          onChange={(v) => {
            setLevel(v);
            setCursor(undefined);
          }}
        />
        <Select
          allowClear
          placeholder="有效期"
          style={{ width: 140 }}
          options={[
            { value: "active", label: "有效" },
            { value: "expired", label: "已过期" },
            { value: "lifetime", label: "终身" },
          ]}
          onChange={(v) => {
            setExpiry(v);
            setCursor(undefined);
          }}
        />
      </Space>
      {(members.isError || plans.isError) && (
        <Alert
          type="error"
          title="会员数据加载失败"
          action={
            <Button
              onClick={() => {
                void members.refetch();
                void plans.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      <Table<Member>
        rowKey="id"
        loading={members.isLoading}
        dataSource={members.data?.items ?? []}
        pagination={false}
        scroll={{ x: 700 }}
        columns={[
          { title: "账号", dataIndex: "accountId" },
          { title: "昵称", dataIndex: "nickname" },
          { title: "存储等级", dataIndex: "vipLevel" },
          {
            title: "到期时间",
            render: (_, r) =>
              r.vipLevel === 4
                ? "终身"
                : r.vipExpiresAt
                  ? formatDateTime(r.vipExpiresAt)
                  : "无",
          },
          {
            title: "操作",
            render: (_, r) => (
              <Button
                disabled={
                  plans.isError || !plans.data?.length || mutation.isPending
                }
                onClick={() => {
                  setTarget(r);
                  setGrantLevel(Math.min(4, Math.max(1, r.vipLevel)));
                  setNote("");
                  key.current = crypto.randomUUID();
                }}
              >
                激活 / 升级
              </Button>
            ),
          },
        ]}
        expandable={{
          expandedRowRender: (r) => (
            <>
              <Typography.Text>最近 10 次授权记录</Typography.Text>
              <Table
                rowKey="id"
                pagination={false}
                dataSource={r.membershipGrantsReceived}
                columns={[
                  { title: "原等级", dataIndex: "previousLevel" },
                  { title: "新等级", dataIndex: "newLevel" },
                  { title: "操作人", dataIndex: "operatorUserID" },
                  { title: "备注", dataIndex: "note" },
                  {
                    title: "时间",
                    dataIndex: "createdAt",
                    render: formatDateTime,
                  },
                ]}
              />
            </>
          ),
        }}
      />
      <Space>
        <Button disabled={!cursor} onClick={() => setCursor(undefined)}>
          首页
        </Button>
        <Button
          disabled={!members.data?.nextCursor || members.isFetching}
          onClick={() => setCursor(members.data!.nextCursor!)}
        >
          下一页
        </Button>
        <Select
          placeholder="完整授权历史"
          style={{ width: 240 }}
          value={historyUser?.id}
          options={(members.data?.items ?? []).map((m) => ({
            value: m.id,
            label: m.accountId,
          }))}
          onChange={(id) => {
            setHistoryUser(members.data!.items.find((m) => m.id === id));
            setHistoryCursor(undefined);
          }}
        />
      </Space>
      <Modal
        title={`${historyUser?.accountId ?? ""} 完整授权历史`}
        width={900}
        open={!!historyUser}
        footer={null}
        onCancel={() => setHistoryUser(undefined)}
      >
        {history.isError && (
          <Alert
            type="error"
            title="历史加载失败"
            action={
              <Button onClick={() => void history.refetch()}>重试</Button>
            }
          />
        )}
        <Table
          rowKey="id"
          loading={history.isLoading}
          pagination={false}
          dataSource={history.data?.items ?? []}
          columns={[
            { title: "原等级", dataIndex: "previousLevel" },
            { title: "新等级", dataIndex: "newLevel" },
            { title: "操作人", dataIndex: "operatorUserID" },
            { title: "备注", dataIndex: "note" },
            { title: "时间", dataIndex: "createdAt", render: formatDateTime },
          ]}
        />
        <Space>
          <Button
            disabled={!historyCursor}
            onClick={() => setHistoryCursor(undefined)}
          >
            首页
          </Button>
          <Button
            disabled={!history.data?.nextCursor || history.isFetching}
            onClick={() => setHistoryCursor(history.data!.nextCursor!)}
          >
            下一页
          </Button>
        </Space>
      </Modal>
      <Modal
        title={`激活 / 升级 ${target?.accountId ?? ""}`}
        open={!!target}
        confirmLoading={mutation.isPending}
        cancelButtonProps={{ disabled: mutation.isPending }}
        onCancel={() => {
          if (!mutation.isPending) setTarget(undefined);
        }}
        onOk={() => {
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <Alert
          type="info"
          title="此操作将写入授权审计并发放对应权益。请核实目标账号与等级。"
        />
        <Select
          value={grantLevel}
          disabled={mutation.isPending}
          options={(plans.data ?? []).map((p) => ({
            value: p.level,
            label: `${p.key} (${p.priceCny} CNY)`,
          }))}
          onChange={setGrantLevel}
        />
        <Input.TextArea
          placeholder="授权备注"
          value={note}
          disabled={mutation.isPending}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </Space>
  );
}
