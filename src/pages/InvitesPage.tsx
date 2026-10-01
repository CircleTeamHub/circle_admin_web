import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
} from "antd";
import { ApiError } from "../api/client";
import {
  platformList,
  platformWrite,
  personLabel,
  type Campaign,
  type CampaignCreate,
  type CampaignUpdate,
  type PersonalInvite,
  type Referral,
} from "../api/platform";
import { PageError } from "../components/PageError";
import { formatDateTime } from "../utils/format";

function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
export function InvitesPage() {
  const [tab, setTab] = useState("personal");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const [campaignID, setCampaignID] = useState<string>();
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [conflict, setConflict] = useState(false);
  const [form] = Form.useForm();
  const operation = useRef({ key: "", payload: "" });
  const personal = useQuery({
    queryKey: ["invite-personal", page, search],
    queryFn: () =>
      platformList<PersonalInvite>("/admin/operations/invite-codes", {
        page,
        limit: 20,
        search,
      }),
    enabled: tab === "personal",
  });
  const campaigns = useQuery({
    queryKey: ["invite-campaigns", page, search],
    queryFn: () =>
      platformList<Campaign>("/admin/operations/campaign-invites", {
        page,
        limit: 20,
        search,
      }),
    enabled: tab === "campaigns",
  });
  const referrals = useQuery({
    queryKey: ["invite-referrals", page, search, status, campaignID],
    queryFn: () =>
      platformList<Referral>("/admin/operations/referrals", {
        page,
        limit: 20,
        search,
        status,
        campaignID,
      }),
    enabled: tab === "referrals",
  });
  const active =
    tab === "personal" ? personal : tab === "campaigns" ? campaigns : referrals;
  function open(row: Campaign | "new") {
    setEditing(row);
    setError(undefined);
    setConflict(false);
    form.resetFields();
    operation.current = { key: crypto.randomUUID(), payload: "" };
    form.setFieldsValue(
      row === "new"
        ? { count: 1, maxUses: 1 }
        : { ...row, expiresAt: localInput(row.expiresAt) },
    );
  }
  function save(values: CampaignCreate & CampaignUpdate) {
    if (!editing || busy || conflict) return;
    const expiresAt = new Date(values.expiresAt).toISOString();
    const payload =
      editing === "new"
        ? {
            name: values.name.trim(),
            ownerAccountId: values.ownerAccountId.trim(),
            count: values.count,
            maxUses: values.maxUses,
            expiresAt,
            reason: values.reason.trim(),
          }
        : {
            enabled: values.enabled,
            maxUses: values.maxUses,
            expiresAt,
            reason: values.reason.trim(),
            version: editing.version,
          };
    Modal.confirm({
      title: editing === "new" ? "确认生成活动邀请码" : "确认修改邀请码配置",
      content: `原因：${payload.reason}`,
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
            `/admin/operations/campaign-invites${editing === "new" ? "" : `/${editing.id}`}`,
            editing === "new" ? "POST" : "PATCH",
            payload,
            editing === "new" ? operation.current.key : undefined,
          );
          setEditing(null);
          await campaigns.refetch();
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
  const pagination = {
    current: page,
    pageSize: 20,
    total: Math.min(active.data?.total ?? 0, 10000),
    showSizeChanger: false,
    onChange: setPage,
  };
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Title level={3}>邀请码与邀请关系</Typography.Title>
      <Tabs
        activeKey={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
          setSearch("");
        }}
        items={[
          { key: "personal", label: "个人邀请码" },
          { key: "campaigns", label: "活动邀请码" },
          { key: "referrals", label: "邀请关系" },
        ]}
      />
      <Form
        layout="inline"
        key={tab}
        onFinish={(v) => {
          setSearch(v.search?.trim() || "");
          setStatus(v.status);
          setCampaignID(v.campaignID?.trim() || undefined);
          setPage(1);
        }}
      >
        <Form.Item name="search">
          <Input placeholder="账号 / 邀请码 / 活动名称" maxLength={64} />
        </Form.Item>
        {tab === "referrals" && (
          <>
            <Form.Item name="status">
              <Select
                allowClear
                placeholder="状态"
                style={{ width: 150 }}
                options={[
                  "PENDING",
                  "REWARDED",
                  "CAPPED",
                  "REJECTED",
                  "EXPIRED",
                ].map((value) => ({ value }))}
              />
            </Form.Item>
            <Form.Item name="campaignID" initialValue={campaignID}>
              <Input placeholder="活动 ID" />
            </Form.Item>
          </>
        )}
        <Button htmlType="submit">查询</Button>
        {tab === "campaigns" && (
          <Button type="primary" onClick={() => open("new")}>
            生成邀请码
          </Button>
        )}
      </Form>
      {active.error && (
        <PageError error={active.error} onRetry={() => void active.refetch()} />
      )}
      {tab === "personal" && (
        <Table<PersonalInvite>
          rowKey="id"
          loading={personal.isFetching}
          dataSource={personal.data?.items ?? []}
          pagination={pagination}
          columns={[
            { title: "邀请人", render: (_, r) => personLabel(r) },
            { title: "邀请码", dataIndex: "inviteCode" },
            { title: "邀请人数", render: (_, r) => r._count.referralsSent },
          ]}
        />
      )}
      {tab === "campaigns" && (
        <Table<Campaign>
          rowKey="id"
          loading={campaigns.isFetching}
          dataSource={campaigns.data?.items ?? []}
          pagination={pagination}
          scroll={{ x: 1000 }}
          columns={[
            { title: "名称", dataIndex: "name" },
            { title: "邀请码", dataIndex: "code" },
            { title: "邀请人", render: (_, r) => personLabel(r.owner) },
            {
              title: "使用人数",
              render: (_, r) => `${r.usedCount} / ${r.maxUses}`,
            },
            { title: "有效期", dataIndex: "expiresAt", render: formatDateTime },
            {
              title: "状态",
              render: (_, r) =>
                !r.enabled
                  ? "停用"
                  : Date.parse(r.expiresAt) <= Date.now()
                    ? "过期"
                    : r.usedCount >= r.maxUses
                      ? "已满"
                      : "可用",
            },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Button onClick={() => open(r)}>编辑 / 启停</Button>
                  <Button
                    onClick={() => {
                      setCampaignID(r.id);
                      setStatus(undefined);
                      setSearch("");
                      setPage(1);
                      setTab("referrals");
                    }}
                  >
                    邀请关系
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      )}
      {tab === "referrals" && (
        <Table<Referral>
          rowKey="id"
          loading={referrals.isFetching}
          dataSource={referrals.data?.items ?? []}
          pagination={pagination}
          scroll={{ x: 1000 }}
          columns={[
            { title: "邀请人", render: (_, r) => personLabel(r.inviter) },
            { title: "被邀请人", render: (_, r) => personLabel(r.invitee) },
            { title: "状态", dataIndex: "status" },
            {
              title: "奖励",
              render: (_, r) =>
                `${r.rewardedAt ? "已发放" : "承诺金额（未发放）"}：邀请人 ${r.inviterReward} / 被邀请人 ${r.inviteeReward}`,
            },
            {
              title: "资格时间",
              dataIndex: "eligibleAt",
              render: formatDateTime,
            },
            {
              title: "发放时间",
              dataIndex: "rewardedAt",
              render: formatDateTime,
            },
            { title: "失败原因", dataIndex: "failureReason" },
          ]}
        />
      )}
      <Modal
        open={!!editing}
        title={editing === "new" ? "生成活动邀请码" : "编辑活动邀请码"}
        confirmLoading={busy}
        okButtonProps={{ disabled: conflict }}
        onCancel={() => {
          if (!busy) setEditing(null);
        }}
        onOk={() => form.submit()}
      >
        {!!error && <PageError error={error} />}
        {conflict && editing !== "new" && (
          <Button
            onClick={async () => {
              const result = await campaigns.refetch();
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
        <Form form={form} layout="vertical" onFinish={save}>
          {editing === "new" ? (
            <>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, whitespace: true, max: 80 }]}
              >
                <Input maxLength={80} />
              </Form.Item>
              <Form.Item
                name="ownerAccountId"
                label="邀请人普通 App 账号"
                rules={[{ required: true, min: 4, max: 32 }]}
              >
                <Input maxLength={32} />
              </Form.Item>
              <Form.Item
                name="count"
                label="生成数量"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={50} precision={0} />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Form.Item
            name="maxUses"
            label="使用上限"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={
                typeof editing === "object" && editing
                  ? Math.max(1, editing.usedCount)
                  : 1
              }
              max={100000}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            name="expiresAt"
            label="有效期"
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  return !v ||
                    (editing !== "new" && !getFieldValue("enabled")) ||
                    new Date(v) > new Date()
                    ? Promise.resolve()
                    : Promise.reject(new Error("有效期必须晚于当前时间"));
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
