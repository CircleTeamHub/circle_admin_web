import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Descriptions, Drawer, Form, Input, Modal, Space, Table, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { listFriendReports, reviewFriendReport } from "../api/reports";
import { PageError } from "../components/PageError";
import { UserSummary } from "../components/UserSummary";
import type { FriendReport, ReportStatus, ReviewDecision } from "../types";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

const PAGE_SIZE = 20;

export function ReportsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FriendReport | null>(null);
  const [review, setReview] = useState<{ report: FriendReport; decision: ReviewDecision } | null>(
    null,
  );
  const [form] = Form.useForm<{ note?: string }>();

  const reports = useQuery({
    queryKey: ["friendReports", status, page],
    queryFn: () => listFriendReports({ status, page, limit: PAGE_SIZE }),
  });
  const mutation = useMutation({
    mutationFn: ({ report, decision, note }: { report: FriendReport; decision: ReviewDecision; note?: string }) =>
      reviewFriendReport(report.id, decision, note),
    onSuccess: () => {
      message.success("审核完成");
      setReview(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["friendReports"] });
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "审核操作失败"));
    },
  });

  const columns: ColumnsType<FriendReport> = [
    { title: "举报时间", dataIndex: "createdAt", render: (value) => formatDateTime(value) },
    { title: "分类", dataIndex: "category", render: (value) => value || "-" },
    { title: "举报人", dataIndex: "reporter", render: (user) => <UserSummary user={user} /> },
    { title: "被举报人", dataIndex: "targetUser", render: (user) => <UserSummary user={user} /> },
    { title: "状态", dataIndex: "status" },
    { title: "审核人", dataIndex: "reviewer", render: (user) => <UserSummary user={user} /> },
    { title: "审核时间", dataIndex: "reviewedAt", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setSelected(record)}>
            详情
          </Button>
          {record.status === "PENDING" ? (
            <>
              <Button size="small" type="primary" onClick={() => setReview({ report: record, decision: "APPROVE" })}>
                通过
              </Button>
              <Button size="small" danger onClick={() => setReview({ report: record, decision: "REJECT" })}>
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
        activeKey={status}
        onChange={(key) => {
          setStatus(key as ReportStatus);
          setPage(1);
        }}
        items={["PENDING", "APPROVED", "REJECTED"].map((key) => ({ key, label: key }))}
      />
      {reports.isError ? (
        <PageError error={reports.error} onRetry={() => reports.refetch()} message="举报列表加载失败" />
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
      <Drawer title="举报详情" width={560} open={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <Space direction="vertical" size={16} className="page-stack">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="描述">{selected.description || "-"}</Descriptions.Item>
              <Descriptions.Item label="举报人">
                <UserSummary user={selected.reporter} />
              </Descriptions.Item>
              <Descriptions.Item label="被举报人">
                <UserSummary user={selected.targetUser} />
              </Descriptions.Item>
              <Descriptions.Item label="审核备注">{selected.reviewNote || "-"}</Descriptions.Item>
              <Descriptions.Item label="举报时间">{formatDateTime(selected.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{formatDateTime(selected.reviewedAt)}</Descriptions.Item>
            </Descriptions>
            <div>
              <Typography.Text strong>证据</Typography.Text>
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
                <Typography.Paragraph type="secondary">暂无证据</Typography.Paragraph>
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
        onCancel={() => setReview(null)}
        onOk={async () => {
          if (!review) return;
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
