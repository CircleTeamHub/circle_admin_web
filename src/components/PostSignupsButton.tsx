import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Modal, Space, Table, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getPostSignups } from "../api/post-signups";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "./PageError";
function SignupRoster({ postID }: { postID: string }) {
  const [page, setPage] = useState(1);
  const { hasPermission } = useAdminAccess();
  const q = useQuery({
    queryKey: ["post-signups", postID, page],
    queryFn: () => getPostSignups(postID, page),
    gcTime: 0,
  });
  if (q.isError)
    return <PageError error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={12}>
      <Typography.Text type="secondary">
        当前报名记录；已取消的报名不在名单中。查看此名单不会改变作者的未读报名状态。
      </Typography.Text>
      <Button onClick={() => q.refetch()} loading={q.isFetching}>
        刷新报名名单
      </Button>
      <Table
        rowKey="id"
        loading={q.isPending}
        dataSource={q.data?.items ?? []}
        scroll={{ x: 600 }}
        locale={{ emptyText: "暂无报名" }}
        pagination={{
          current: page,
          pageSize: 20,
          total: q.data?.total ?? 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 人报名`,
        }}
        columns={[
          {
            title: "报名人",
            render: (_, row) => (
              <Space>
                <Avatar src={row.user.avatarUrl}>
                  {row.user.nickname.slice(0, 1)}
                </Avatar>
                {hasPermission("USER_READ") ? (
                  <Link to={`/users/${encodeURIComponent(row.user.id)}`}>
                    {row.user.status === "DELETED"
                      ? "已注销用户"
                      : row.user.nickname || row.user.accountId}
                  </Link>
                ) : (
                  <Typography.Text>
                    {row.user.status === "DELETED"
                      ? "已注销用户"
                      : row.user.nickname || row.user.accountId}
                  </Typography.Text>
                )}
              </Space>
            ),
          },
          { title: "账号", render: (_, row) => row.user.accountId },
          {
            title: "报名时间",
            dataIndex: "createdAt",
            render: (v: string) =>
              new Date(v).toLocaleString("zh-CN", { hour12: false }),
          },
          {
            title: "作者查看状态",
            render: (_, row) =>
              row.seenByAuthor
                ? row.seenAt
                  ? `已查看（${new Date(row.seenAt).toLocaleString("zh-CN", { hour12: false })}）`
                  : "已查看"
                : "未查看",
          },
        ]}
      />
    </Space>
  );
}
export function PostSignupsButton({ postID }: { postID: string }) {
  const [open, setOpen] = useState(false);
  const { hasPermission } = useAdminAccess();
  if (!hasPermission("COMMUNITY_MANAGE")) return null;
  return (
    <>
      <Button type="link" size="small" onClick={() => setOpen(true)}>
        查看报名名单
      </Button>
      <Modal
        title="报名名单"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={860}
        destroyOnHidden
      >
        {open && <SignupRoster key={postID} postID={postID} />}
      </Modal>
    </>
  );
}
