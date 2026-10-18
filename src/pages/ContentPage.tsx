import { PostSignupsButton } from "../components/PostSignupsButton";
import { Identifier, CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
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
      <Typography.Title level={3}>圈子内容管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        查看圈子动态、报名人数和报名名单，点击报名人的姓名可进入用户详情。用户笔记在用户详情查看，聊天记录在会话管理查看。
      </Typography.Paragraph>
      <Space wrap>
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
            label: displayLabel("contentStatus", value),
          }))}
        />
      </Space>
      {posts.isError && (
        <PageError error={posts.error} onRetry={() => posts.refetch()} />
      )}
      <Table
        rowKey="id"
        className="content-posts-table"
        scroll={{ x: 980 }}
        loading={posts.isLoading}
        dataSource={posts.data?.items ?? []}
        pagination={{
          current: page,
          pageSize: 20,
          total: posts.data?.total ?? 0,
          onChange: setPage,
        }}
        columns={[
          { title: "内容", dataIndex: "content", width: 320, ellipsis: true },
          { title: "圈子", width: 180, ellipsis: true, render: (_, row) => row.circle.name },
          {
            title: "状态",
            width: 100,
            dataIndex: "status",
            render: (value: string | null) => (
              <CodeValue domain="contentStatus" value={value} />
            ),
          },
          {
            title: "报名人数",
            width: 100,
            dataIndex: "signupCount",
            render: (count: number) => `${count} 人`,
          },
          {
            title: "操作",
            width: 280,
            fixed: "right",
            render: (_, post) => (
              <div className="content-post-actions">
                <Button type="link" size="small" onClick={() => setSelected(post.id)}>详情</Button>
                <PostSignupsButton postID={post.id} />
                <span className="content-post-actions-divider" aria-hidden="true" />
                <Button
                  type="text"
                  size="small"
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
              </div>
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
                {
                  key: "id",
                  label: "ID",
                  children: <Identifier value={detail.data.id} inline />,
                },
                {
                  key: "status",
                  label: "状态",
                  children: (
                    <CodeValue
                      domain="contentStatus"
                      value={detail.data.status}
                    />
                  ),
                },
                {
                  key: "author",
                  label: "作者",
                  children:
                    detail.data.author.nickname || detail.data.author.accountId,
                },
                {
                  key: "signups",
                  label: "报名人数",
                  children: (
                    <Space>
                      {detail.data.signupCount} 人{" "}
                      <PostSignupsButton postID={detail.data.id} />
                    </Space>
                  ),
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
            ? "确认恢复帖子（恢复后为已结束）"
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
