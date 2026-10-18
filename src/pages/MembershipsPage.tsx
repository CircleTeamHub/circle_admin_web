import { Identifier } from "../components/ReadableValue";
import { membershipLabel } from "../utils/display";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  InputNumber,
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
export function membershipGrantPlanLabel(grant: {
  planId?: string | null;
  newLevel: number;
  quantity?: number;
}) {
  if (grant.planId === "daily")
    return `每日会员（${grant.quantity ?? 1}天白银权益）`;
  const duration: Record<number, string> = {
    1: "1个月",
    2: "6个月",
    3: "12个月",
    4: "终身",
  };
  return `${membershipLabel(grant.newLevel)}（${duration[grant.newLevel] ?? "未记录时长"}）`;
}
export function MembershipsPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [level, setLevel] = useState<number>();
  const [expiry, setExpiry] = useState<string>();
  const [cursor, setCursor] = useState<string>();
  const [target, setTarget] = useState<Member>();
  const [grantPlan, setGrantPlan] = useState("1");
  const [dailyQuantity, setDailyQuantity] = useState<number | null>(1);
  const validQuantity =
    dailyQuantity !== null &&
    Number.isInteger(dailyQuantity) &&
    dailyQuantity >= 1 &&
    dailyQuantity <= 30;
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
        targetLevel: grantPlan === "daily" ? 1 : Number(grantPlan),
        ...(grantPlan === "daily"
          ? { planId: "daily" as const, quantity: dailyQuantity! }
          : {}),
        idempotencyKey: key.current,
        note: note.trim(),
      }),
    retry: false,
    onSuccess: () => {
      setTarget(undefined);
      void qc.invalidateQueries({ queryKey: ["memberships"] });
      void qc.invalidateQueries({ queryKey: ["membershipHistory"] });
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
              label: membershipLabel(p.level),
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
          {
            title: "会员等级",
            render: (_, member) => (
              <Space orientation="vertical" size={0}>
                <Typography.Text>
                  {membershipLabel(member.vipLevel)}
                </Typography.Text>
                {member.membershipGrantsReceived[0]?.planId === "daily" && (
                  <Typography.Text type="secondary">
                    最近授权：每日会员
                  </Typography.Text>
                )}
              </Space>
            ),
          },
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
                  setGrantPlan(String(Math.min(4, Math.max(1, r.vipLevel))));
                  setNote("");
                  setDailyQuantity(1);
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
                  {
                    title: "原等级",
                    dataIndex: "previousLevel",
                    render: membershipLabel,
                  },
                  {
                    title: "新等级",
                    dataIndex: "newLevel",
                    render: membershipLabel,
                  },
                  {
                    title: "授权方案",
                    render: (_, grant) => membershipGrantPlanLabel(grant),
                  },
                  {
                    title: "授权后到期",
                    dataIndex: "newExpiresAt",
                    render: (value: string | null, grant) =>
                      grant.newLevel === 4
                        ? "终身"
                        : value
                          ? formatDateTime(value)
                          : "未记录",
                  },
                  {
                    title: "操作人",
                    dataIndex: "operatorUserID",
                    render: (value: string) => (
                      <Identifier value={value} label="操作人" />
                    ),
                  },
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
            {
              title: "原等级",
              dataIndex: "previousLevel",
              render: membershipLabel,
            },
            { title: "新等级", dataIndex: "newLevel", render: membershipLabel },
            {
              title: "授权方案",
              render: (_, grant) => membershipGrantPlanLabel(grant),
            },
            {
              title: "授权后到期",
              dataIndex: "newExpiresAt",
              render: (value: string | null, grant) =>
                grant.newLevel === 4
                  ? "终身"
                  : value
                    ? formatDateTime(value)
                    : "未记录",
            },
            {
              title: "操作人",
              dataIndex: "operatorUserID",
              render: (value: string) => (
                <Identifier value={value} label="操作人" />
              ),
            },
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
        okText="确认发放"
        open={!!target}
        confirmLoading={mutation.isPending}
        okButtonProps={{ disabled: grantPlan === "daily" && !validQuantity }}
        cancelButtonProps={{ disabled: mutation.isPending }}
        onCancel={() => {
          if (!mutation.isPending) setTarget(undefined);
        }}
        onOk={() => {
          if (!mutation.isPending && (grantPlan !== "daily" || validQuantity))
            mutation.mutate();
        }}
      >
        <Alert
          type="info"
          title="此处发放会员权益并记录审计，不会自动收款。每日会员每份提供24小时白银权益，一次最多30份；有效的白银会员会从现有到期时间继续增加天数，不会降低或缩短现有权益。"
        />
        <Select
          aria-label="会员开通方案"
          value={grantPlan}
          disabled={mutation.isPending}
          style={{ width: "100%" }}
          options={[
            ...((plans.data ?? []).some((p) => p.level === 1)
              ? [{ value: "daily", label: "每日会员（1天白银权益，19.9元）" }]
              : []),
            ...(plans.data ?? []).map((p) => ({
              value: String(p.level),
              label: `${membershipLabel(p.level)}（${p.priceCny} 元）`,
            })),
          ]}
          onChange={setGrantPlan}
        />
        {grantPlan === "daily" && (
          <Space
            orientation="vertical"
            style={{ marginTop: 12, marginBottom: 12 }}
          >
            <Typography.Text>每日会员数量（1～30份，每份1天）</Typography.Text>
            <InputNumber
              aria-label="每日会员数量"
              min={1}
              max={30}
              precision={0}
              value={dailyQuantity}
              disabled={mutation.isPending}
              onChange={(v) => setDailyQuantity(v)}
            />
            <Typography.Text type={validQuantity ? "secondary" : "danger"}>
              {validQuantity
                ? `本次增加 ${dailyQuantity} 天白银权益；此处只发放权益，不自动扣款。`
                : "请输入1至30的整数"}
            </Typography.Text>
          </Space>
        )}
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
