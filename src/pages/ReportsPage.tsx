import { PostDetails } from "../components/PostDetails";
import { Link } from "react-router-dom";
import { useAdminAccess } from "../auth/admin-access";
import type { AdminUser } from "../types";
import { Identifier, CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import { useUrlValue } from "./use-url-value";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import {
  listReports,
  reviewReport,
  type ReportKind,
  type ModerationReport,
} from "../api/moderation";
import { PageError } from "../components/PageError";
import { UserSummary } from "../components/UserSummary";
import type { ReportStatus, ReviewDecision } from "../types";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

function ReportUser({ user, userID }: { user?: AdminUser | null; userID?: string }) {
  const { hasPermission } = useAdminAccess();
  const id = user?.id || userID;
  const name = user?.status === "DELETED" ? "已注销用户" : user?.nickname || user?.accountId || "用户资料不可用";
  return (
    <Space direction="vertical" size={0}>
      {id && user && hasPermission("USER_READ") ? (
        <Link to={`/users/${encodeURIComponent(id)}`}>{name}</Link>
      ) : <Typography.Text>{name}</Typography.Text>}
      <Typography.Text type="secondary">
        {user?.accountId ? `账号 ID：${user.accountId}` : "账号信息未记录"}
      </Typography.Text>
    </Space>
  );
}

const PAGE_SIZE = 20;

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useUrlValue<ReportKind>("kind", "friend", [
    "friend",
    "group",
    "post",
  ]);
  const [status, setStatus] = useUrlValue<ReportStatus>("status", "PENDING", [
    "PENDING",
    "APPROVED",
    "REJECTED",
  ]);
  const [page, setPage] = useUrlValue<number>("page", 1);
  const [selectedPost, setSelectedPost] = useState<string>();
  const [selected, setSelected] = useState<ModerationReport | null>(null);
  const [review, setReview] = useState<{
    kind: ReportKind;
    report: ModerationReport;
    decision: ReviewDecision;
  } | null>(null);
  const [form] = Form.useForm<{ note?: string }>();

  const reports = useQuery({
    queryKey: ["moderationReports", kind, status, page],
    queryFn: () => listReports(kind, { status, page, limit: PAGE_SIZE }),
  });
  const mutation = useMutation({
    mutationFn: ({
      kind: reportKind,
      report,
      decision,
      note,
    }: {
      kind: ReportKind;
      report: ModerationReport;
      decision: ReviewDecision;
      note?: string;
    }) => reviewReport(reportKind, report.id, decision, note),
    onSuccess: () => {
      message.success("审核完成");
      setReview(null);
      setSelected(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["moderationReports"] });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["moderationReports"] });
      message.error(getErrorMessage(error, "审核操作失败"));
    },
  });

  const columns: ColumnsType<ModerationReport> = [
    {
      title: "举报时间",
      dataIndex: "createdAt",
      render: (value) => formatDateTime(value),
    },
    { title: "分类", dataIndex: "category", render: (value) => value || "-" },
    {
      title: "举报人",
      render: (_, row) => <ReportUser user={row.reporter} userID={row.reporterID} />,
    },
    {
      title: "举报对象",
      render: (_, row) =>
        row.targetUser ? (
          <ReportUser user={row.targetUser} />
        ) : (
          row.postID ? (
            <Button type="link" size="small" onClick={() => setSelectedPost(row.postID)}>帖子详情</Button>
          ) : row.circle?.name || (
            <Identifier
              value={row.groupID || row.postID}
              label={row.groupID ? "群聊" : "帖子"}
            />
          )
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: string | null) => (
        <CodeValue domain="reportStatus" value={value} />
      ),
    },
    {
      title: "审核人",
      render: (_, row) =>
        row.reviewer ? (
          <UserSummary user={row.reviewer} />
        ) : (
          <Identifier value={row.reviewedByID} label="审核人" />
        ),
    },
    {
      title: "审核时间",
      dataIndex: "reviewedAt",
      render: (value) => formatDateTime(value),
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setSelected(record)}>
            详情
          </Button>
          {record.status === "PENDING" ? (
            <>
              <Button
                size="small"
                type="primary"
                disabled={mutation.isPending}
                onClick={() =>
                  setReview({ kind, report: record, decision: "APPROVE" })
                }
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                disabled={mutation.isPending}
                onClick={() =>
                  setReview({ kind, report: record, decision: "REJECT" })
                }
              >
                驳回
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Typography.Title level={3}>举报审核</Typography.Title>
      <Tabs
        activeKey={kind}
        onChange={(key) => {
          if (mutation.isPending) return;
          setKind(key as ReportKind);
          setSelected(null);
          setReview(null);
          form.resetFields();
        }}
        items={[
          { key: "friend", label: "好友举报" },
          { key: "group", label: "群举报" },
          { key: "post", label: "帖子举报" },
        ]}
      />
      <Tabs
        activeKey={status}
        onChange={(key) => {
          setStatus(key as ReportStatus);
        }}
        items={["PENDING", "APPROVED", "REJECTED"].map((key) => ({
          key,
          label: displayLabel("reportStatus", key),
        }))}
      />
      {reports.isError ? (
        <PageError
          error={reports.error}
          onRetry={() => reports.refetch()}
          message="举报列表加载失败"
        />
      ) : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={reports.data?.items || []}
        loading={reports.isLoading}
        locale={{ emptyText: reports.isError ? "加载失败" : "暂无举报" }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: reports.data?.total || 0,
          onChange: setPage,
        }}
      />
      <Drawer title="帖子详情" width={680} open={!!selectedPost} onClose={() => setSelectedPost(undefined)} destroyOnHidden>
        {selectedPost && <PostDetails postID={selectedPost} />}
      </Drawer>
      <Drawer
        title="举报详情"
        width={560}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <Space direction="vertical" size={16} className="page-stack">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="描述">
                {selected.description || selected.reason || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="举报人">
                <ReportUser user={selected.reporter} userID={selected.reporterID} />
              </Descriptions.Item>
              <Descriptions.Item label="被举报人">
                {selected.targetUser && <ReportUser user={selected.targetUser} />}
                {selected.groupID ||
                  selected.postID ||
                  selected.circle?.name ||
                  ""}
              </Descriptions.Item>
              <Descriptions.Item label="审核备注">
                {selected.reviewNote || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="举报时间">
                {formatDateTime(selected.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {formatDateTime(selected.reviewedAt)}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <Typography.Text strong>证据</Typography.Text>
              {selected.postID && <PostDetails postID={selected.postID} />}
              {(selected.evidence || []).length ? (
                <ul>
                  {(selected.evidence || []).map((item) => (
                    <li key={item}>
                      {/^https?:\/\//i.test(item) ? (
                        <a href={item} target="_blank" rel="noreferrer">
                          {item}
                        </a>
                      ) : (
                        item
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Typography.Paragraph type="secondary">
                  暂无证据
                </Typography.Paragraph>
              )}
            </div>
          </Space>
        ) : null}
      </Drawer>
      <Modal
        title={review?.decision === "APPROVE" ? "确认通过举报" : "确认驳回举报"}
        open={!!review}
        okText="确认"
        cancelText="取消"
        confirmLoading={mutation.isPending}
        onCancel={() => {
          if (!mutation.isPending) {
            setReview(null);
            form.resetFields();
          }
        }}
        onOk={async () => {
          if (!review || mutation.isPending) return;
          const values = await form.validateFields();
          mutation.mutate({ ...review, note: values.note });
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="note" label="审核备注" rules={[{ max: 500 }]}>
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
