import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import { useState } from "react";
import {
  getPost,
  listPosts,
  moderatePost,
  type ContentPost,
} from "../api/moderation";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";

export function ContentPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [action, setAction] = useState<{
    post: ContentPost;
    action: "takedown" | "restore";
  }>();
  const [form] = Form.useForm<{ note: string }>();
  const posts = useQuery({
    queryKey: ["contentPosts", page, search, status],
    queryFn: () => listPosts(page, search, status),
  });
  const detail = useQuery({
    queryKey: ["contentPost", selected],
    queryFn: () => getPost(selected!),
    enabled: !!selected,
  });
  const reconcile = () => {
    void client.invalidateQueries({ queryKey: ["contentPosts"] });
    void client.invalidateQueries({ queryKey: ["contentPost"] });
  };
  const mutation = useMutation({
    mutationFn: (note?: string) =>
      moderatePost(action!.post.id, action!.action, note),
    onSuccess: () => {
      message.success("操作完成");
      setAction(undefined);
      form.resetFields();
      reconcile();
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "操作失败，请核对最新状态后重试"));
      reconcile();
    },
  });
  return (
    <Space direction="vertical" className="page-stack" size={16}>
      <Typography.Title level={3}>内容管理</Typography.Title>
      <Space>
        <Input.Search
          placeholder="搜索帖子内容"
          maxLength={200}
          onSearch={(value) => {
            setSearch(value.trim());
            setPage(1);
          }}
        />
        <Select
          allowClear
          placeholder="全部状态"
          style={{ width: 160 }}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={["ACTIVE", "ENDED", "DELETED"].map((value) => ({
            value,
            label: value,
          }))}
        />
      </Space>
      {posts.isError && (
        <PageError error={posts.error} onRetry={() => posts.refetch()} />
      )}
      <Table
        rowKey="id"
        loading={posts.isLoading}
        dataSource={posts.data?.items ?? []}
        pagination={{
          current: page,
          pageSize: 20,
          total: posts.data?.total ?? 0,
          onChange: setPage,
        }}
        columns={[
          { title: "内容", dataIndex: "content", ellipsis: true },
          { title: "圈子", render: (_, row) => row.circle.name },
          { title: "状态", dataIndex: "status" },
          { title: "举报数", dataIndex: "reportCount" },
          {
            title: "操作",
            render: (_, post) => (
              <Space>
                <Button onClick={() => setSelected(post.id)}>详情</Button>
                <Button
                  danger={post.status !== "DELETED"}
                  disabled={mutation.isPending}
                  onClick={() => {
                    form.resetFields();
                    setAction({
                      post,
                      action:
                        post.status === "DELETED" ? "restore" : "takedown",
                    });
                  }}
                >
                  {post.status === "DELETED" ? "恢复" : "下架"}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Drawer
        title="帖子详情"
        open={!!selected}
        onClose={() => setSelected(undefined)}
        width={600}
      >
        {detail.isLoading && <Typography.Text>加载中…</Typography.Text>}
        {detail.isError && (
          <PageError error={detail.error} onRetry={() => detail.refetch()} />
        )}
        {detail.data && (
          <>
            <Descriptions
              column={1}
              items={[
                { key: "id", label: "ID", children: detail.data.id },
                { key: "status", label: "状态", children: detail.data.status },
                {
                  key: "author",
                  label: "作者",
                  children:
                    detail.data.author.nickname || detail.data.author.accountId,
                },
                {
                  key: "reports",
                  label: "举报数",
                  children: detail.data.reportCount,
                },
              ]}
            />
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {detail.data.content}
            </Typography.Paragraph>
            {detail.data.images.map((url, i) => (
              <Typography.Paragraph key={i}>
                {/^https?:\/\//i.test(url) ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    图片 {i + 1}
                  </a>
                ) : (
                  url
                )}
              </Typography.Paragraph>
            ))}
          </>
        )}
      </Drawer>
      <Modal
        title={
          action?.action === "restore"
            ? "确认恢复帖子（恢复为 ENDED）"
            : "确认下架帖子"
        }
        open={!!action}
        confirmLoading={mutation.isPending}
        onCancel={() => {
          if (!mutation.isPending) setAction(undefined);
        }}
        onOk={async () => {
          if (!action || mutation.isPending) return;
          const values = await form.validateFields();
          mutation.mutate(values.note?.trim());
        }}
      >
        <Typography.Paragraph>{action?.post.content}</Typography.Paragraph>
        {action?.action === "restore" ? (
          <Typography.Paragraph>
            仅管理员下架的帖子可以恢复。作者删除的帖子无法恢复。
          </Typography.Paragraph>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              name="note"
              label="下架原因"
              rules={[{ required: true, whitespace: true }, { max: 500 }]}
            >
              <Input.TextArea maxLength={500} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Space>
  );
}
