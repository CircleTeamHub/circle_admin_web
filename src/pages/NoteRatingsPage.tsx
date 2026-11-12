import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Descriptions, Drawer, Form, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  listNoteRatingCases,
  resolveNoteRatingCase,
  type NoteRatingCase,
  type NoteRatingCaseAction,
  type NoteRatingCaseKind,
  type NoteRatingCaseRating,
  type NoteRatingCaseStatus,
  type NoteRatingCaseUser,
} from "../api/note-ratings";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { PageHeader } from "../components/PageHeader";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";
import { useUrlValue } from "./use-url-value";

const PAGE_SIZE = 20;
const CREDIT_DEDUCTION = 15;

const KIND_LABELS: Record<NoteRatingCaseKind, string> = { BURST: "集中刷分", APPEAL: "差评申诉" };
const ACTION_LABELS: Record<NoteRatingCaseAction, string> = {
  RELEASE: "放行",
  VOID: "作废并扣分",
  UPHOLD: "维持差评",
  REVOKE: "撤销差评并扣分",
};
const ACTIONS: Record<NoteRatingCaseKind, NoteRatingCaseAction[]> = {
  BURST: ["RELEASE", "VOID"],
  APPEAL: ["UPHOLD", "REVOKE"],
};
const ACTION_EFFECTS: Record<NoteRatingCaseAction, string> = {
  RELEASE: "暂扣的评分恢复为已计入，计入评分当月的计数。",
  VOID: `这些评分作废，每条评分的评分人扣 ${CREDIT_DEDUCTION} 信用分。`,
  UPHOLD: "差评保留，笔记主人会收到申诉未通过的通知。",
  REVOKE: `差评作废，评分人扣 ${CREDIT_DEDUCTION} 信用分，笔记主人会收到申诉通过的通知。`,
};
const RATING_STATUS_LABELS = { COUNTED: "已计入", HELD: "暂扣", VOID: "已作废" } as const;
const REASON_LABELS: Record<string, string> = {
  INACCURATE: "信息不实",
  EXPIRED: "已失效",
  BAD_EXPERIENCE: "体验差",
  OTHER: "其他",
};

function errorText(error: unknown): string {
  const code = error instanceof ApiError ? (error.payload as { errorCode?: string } | undefined)?.errorCode : undefined;
  if (code === "NOTE_RATING_CASE_RESOLVED") return "该审核单已被其他管理员处理，列表已刷新";
  return getErrorMessage(error, "审核操作失败");
}

function CaseUser({ user, extra }: { user: NoteRatingCaseUser; extra?: string }) {
  const { hasPermission } = useAdminAccess();
  const name = user.nickname || user.accountId;
  return (
    <Space orientation="vertical" size={0}>
      {hasPermission("USER_READ") ? (
        <Link to={`/users/${encodeURIComponent(user.id)}`}>{name}</Link>
      ) : (
        <Typography.Text>{name}</Typography.Text>
      )}
      <Typography.Text type="secondary">账号 ID：{user.accountId}</Typography.Text>
      {extra ? <Typography.Text type="secondary">{extra}</Typography.Text> : null}
    </Space>
  );
}

function ratingSummary(row: NoteRatingCase): string {
  const good = row.ratings.filter((rating) => rating.value === "GOOD").length;
  const bad = row.ratings.length - good;
  return [good ? `${good} 条好评` : null, bad ? `${bad} 条差评` : null].filter(Boolean).join("、") || "-";
}

const evidenceColumns: ColumnsType<NoteRatingCaseRating> = [
  { title: "评分时间", dataIndex: "createdAt", render: (value) => formatDateTime(value) },
  {
    title: "评分人",
    render: (_, rating) => (
      <CaseUser
        user={rating.rater}
        extra={`信用分 ${rating.rater.creditScore} · 注册于 ${formatDateTime(rating.rater.registeredAt)}`}
      />
    ),
  },
  {
    title: "笔记",
    render: (_, rating) =>
      rating.note.title ?? <Typography.Text type="secondary">笔记已永久删除</Typography.Text>,
  },
  {
    title: "评价",
    render: (_, rating) => (
      <Space orientation="vertical" size={0}>
        <Typography.Text>{rating.value === "GOOD" ? "👍 好评" : "👎 差评"}</Typography.Text>
        {rating.reason ? <Typography.Text type="secondary">{REASON_LABELS[rating.reason] ?? rating.reason}</Typography.Text> : null}
        {rating.comment ? <Typography.Text>{rating.comment}</Typography.Text> : null}
      </Space>
    ),
  },
  { title: "状态", dataIndex: "status", render: (value: NoteRatingCaseRating["status"]) => RATING_STATUS_LABELS[value] },
];

export function NoteRatingsPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useUrlValue<"ALL" | NoteRatingCaseKind>("kind", "ALL", ["ALL", "BURST", "APPEAL"]);
  const [status, setStatus] = useUrlValue<NoteRatingCaseStatus>("status", "PENDING", ["PENDING", "RESOLVED"]);
  const [page, setPage] = useUrlValue<number>("page", 1);
  const [selected, setSelected] = useState<NoteRatingCase | null>(null);
  const [decision, setDecision] = useState<{ item: NoteRatingCase; action: NoteRatingCaseAction } | null>(null);
  const [form] = Form.useForm<{ note?: string }>();

  const cases = useQuery({
    queryKey: ["noteRatingCases", kind, status, page],
    queryFn: () =>
      listNoteRatingCases({ status, kind: kind === "ALL" ? undefined : kind, page, limit: PAGE_SIZE }),
  });
  // Resolving the last pending case on a page drops it out of the list; step back to
  // the last page that still has cases instead of leaving the admin on an empty one.
  const lastPage = Math.max(1, Math.ceil((cases.data?.total ?? 0) / PAGE_SIZE));
  useEffect(() => {
    if (cases.data?.items.length === 0 && page > lastPage) setPage(lastPage);
  }, [cases.data, page, lastPage, setPage]);
  const mutation = useMutation({
    mutationFn: ({ item, action, note }: { item: NoteRatingCase; action: NoteRatingCaseAction; note?: string }) =>
      resolveNoteRatingCase(item.id, action, note),
    onSuccess: () => {
      message.success("处理完成");
      setDecision(null);
      setSelected(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["noteRatingCases"] });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["noteRatingCases"] });
      message.error(errorText(error));
    },
  });

  const columns: ColumnsType<NoteRatingCase> = [
    { title: "提交时间", dataIndex: "createdAt", render: (value) => formatDateTime(value) },
    { title: "类型", dataIndex: "kind", render: (value: NoteRatingCaseKind) => <Tag>{KIND_LABELS[value]}</Tag> },
    { title: "笔记主人", render: (_, row) => <CaseUser user={row.owner} /> },
    { title: "涉及评分", render: (_, row) => ratingSummary(row) },
    {
      title: "处理结果",
      render: (_, row) =>
        row.resolution ? (
          <Space orientation="vertical" size={0}>
            <Typography.Text>{ACTION_LABELS[row.resolution]}</Typography.Text>
            <Typography.Text type="secondary">
              {row.resolvedBy ? `${row.resolvedBy.nickname || row.resolvedBy.accountId} · ` : ""}
              {formatDateTime(row.resolvedAt)}
            </Typography.Text>
          </Space>
        ) : (
          "待处理"
        ),
    },
    {
      title: "操作",
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => setSelected(row)}>
            证据
          </Button>
          {row.status === "PENDING"
            ? ACTIONS[row.kind].map((action) => (
                <Button
                  key={action}
                  size="small"
                  type={action === "RELEASE" || action === "UPHOLD" ? "default" : "primary"}
                  danger={action === "VOID" || action === "REVOKE"}
                  disabled={mutation.isPending}
                  onClick={() => setDecision({ item: row, action })}
                >
                  {ACTION_LABELS[action]}
                </Button>
              ))
            : null}
        </Space>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <PageHeader
        title="笔记评分审核"
        description={`集中刷分被暂扣的评分与笔记主人的差评申诉。作废 / 撤销会给每条评分的评分人扣 ${CREDIT_DEDUCTION} 信用分。`}
      />
      <Tabs
        activeKey={kind}
        onChange={(key) => {
          setKind(key as "ALL" | NoteRatingCaseKind);
          setPage(1);
        }}
        items={[
          { key: "ALL", label: "全部" },
          { key: "BURST", label: KIND_LABELS.BURST },
          { key: "APPEAL", label: KIND_LABELS.APPEAL },
        ]}
      />
      <Tabs
        activeKey={status}
        onChange={(key) => {
          setStatus(key as NoteRatingCaseStatus);
          setPage(1);
        }}
        items={[
          { key: "PENDING", label: "待处理" },
          { key: "RESOLVED", label: "已处理" },
        ]}
      />
      {cases.isError ? (
        <PageError error={cases.error} onRetry={() => cases.refetch()} message="审核列表加载失败" />
      ) : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={cases.data?.items || []}
        loading={cases.isLoading}
        locale={{ emptyText: cases.isError ? "加载失败" : "暂无审核单" }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: cases.data?.total || 0, onChange: setPage }}
      />
      <Drawer title="审核证据" width={880} open={!!selected} onClose={() => setSelected(null)} destroyOnHidden>
        {selected ? (
          <Space orientation="vertical" size={16} className="page-stack">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="类型">{KIND_LABELS[selected.kind]}</Descriptions.Item>
              <Descriptions.Item label="笔记主人">
                <CaseUser user={selected.owner} />
              </Descriptions.Item>
              {selected.kind === "APPEAL" ? (
                <Descriptions.Item label="申诉理由">{selected.ownerReason || "-"}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label="提交时间">{formatDateTime(selected.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="处理结果">
                {selected.resolution ? ACTION_LABELS[selected.resolution] : "待处理"}
              </Descriptions.Item>
              <Descriptions.Item label="处理备注">{selected.resolutionNote || "-"}</Descriptions.Item>
            </Descriptions>
            <Table
              rowKey="id"
              size="small"
              columns={evidenceColumns}
              dataSource={selected.ratings}
              pagination={false}
            />
          </Space>
        ) : null}
      </Drawer>
      <Modal
        title={decision ? `确认${ACTION_LABELS[decision.action]}` : ""}
        open={!!decision}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: decision?.action === "VOID" || decision?.action === "REVOKE" }}
        confirmLoading={mutation.isPending}
        onCancel={() => {
          if (!mutation.isPending) {
            setDecision(null);
            form.resetFields();
          }
        }}
        onOk={async () => {
          if (!decision || mutation.isPending) return;
          const values = await form.validateFields();
          mutation.mutate({ ...decision, note: values.note?.trim() || undefined });
        }}
      >
        {decision ? (
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Alert type={decision.action === "VOID" || decision.action === "REVOKE" ? "warning" : "info"} showIcon message={ACTION_EFFECTS[decision.action]} />
            <Typography.Text type="secondary">
              {KIND_LABELS[decision.item.kind]} · {ratingSummary(decision.item)}
            </Typography.Text>
            <Form form={form} layout="vertical">
              <Form.Item name="note" label="处理备注（仅管理台可见）" rules={[{ max: 500 }]}>
                <Input.TextArea rows={3} maxLength={500} showCount />
              </Form.Item>
            </Form>
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
}
