import { useQuery } from "@tanstack/react-query";
import { Card, Space, Table, Tabs, Tag, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getUserResources,
  type UserResource,
  type UserResourceKind,
} from "../api/user-resources";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { displayLabel } from "../utils/display";
export const noteStatus = (status: string) =>
  ({ ACTIVE: "正常", UNLISTED: "已下架", DELETED: "已删除" })[status] ??
  "未识别状态";
function entry(row: UserResource, userID: string) {
  if ("role" in row)
    return {
      name: row.circle.name,
      href: `/community/circles/${encodeURIComponent(row.circle.id)}`,
      info: `${row.role === "OWNER" ? "圈主" : displayLabel("memberRole", row.role)} · ${row.circle.memberCount} 人 · ${row.circle.postCount} 条动态`,
      status: row.circle.deleted ? "圈子已解散" : "已加入",
      time: row.createdAt,
    };
  if ("group" in row)
    return {
      name: row.group.name,
      href: `/community/groups/${encodeURIComponent(row.group.id)}`,
      info: `${row.group.circle ? "圈子群" : "独立群"} · ${row.group.memberCount} 人`,
      status: "在群",
      time: row.joinedAt,
    };
  if ("content" in row)
    return {
      name:
        row.content.trim().slice(0, 80) || "无文字动态（点击查看图片与详情）",
      href: `/users/${encodeURIComponent(userID)}/posts/${encodeURIComponent(row.id)}`,
      info: `发布到 ${row.circle.name}`,
      status: displayLabel("contentStatus", row.status),
      time: row.createdAt,
    };
  return {
    name: row.title || "未命名笔记",
    href: `/users/${encodeURIComponent(userID)}/notes/${encodeURIComponent(row.id)}`,
    info: `${row.isCollected ? "收藏副本" : "本人创建"} · ${row.imageCount} 张图片 / ${row.videoCount} 段视频 / ${row.audioCount} 段音频`,
    status: `${noteStatus(row.status)} · ${row.available ? "可用" : "不可用"}`,
    time: row.updatedAt,
  };
}
function ResourceList({
  userID,
  kind,
}: {
  userID: string;
  kind: UserResourceKind;
}) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["user-resources", userID, kind, page],
    queryFn: () => getUserResources(userID, kind, page),
  });
  if (q.isError)
    return <PageError error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Table
      rowKey="id"
      loading={q.isPending}
      dataSource={(q.data?.items ?? []).map((row) => ({
        id: row.id,
        ...entry(row, userID),
      }))}
      scroll={{ x: 650 }}
      pagination={{
        current: page,
        pageSize: 20,
        total: q.data?.total ?? 0,
        onChange: setPage,
        showSizeChanger: false,
        showTotal: (total) => `共 ${total} 条`,
      }}
      locale={{ emptyText: "暂无记录" }}
      columns={[
        {
          title: "名称 / 内容",
          render: (_, row) => (
            <Space orientation="vertical" size={2}>
              <Link
                to={row.href}
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {row.name}
              </Link>
              <Typography.Text type="secondary">{row.info}</Typography.Text>
            </Space>
          ),
        },
        {
          title: "状态",
          dataIndex: "status",
          render: (text: string) => <Tag>{text}</Tag>,
        },
        {
          title:
            kind === "notes"
              ? "更新时间"
              : kind === "posts"
                ? "发布时间"
                : "加入时间",
          dataIndex: "time",
          render: (value: string) =>
            new Date(value).toLocaleString("zh-CN", { hour12: false }),
        },
      ]}
    />
  );
}
export function UserResourcesCard({ userID }: { userID: string }) {
  const { hasPermission } = useAdminAccess();
  const items: Array<{ key: UserResourceKind; label: string }> = [
    ...(hasPermission("COMMUNITY_MANAGE")
      ? [
          { key: "circles" as const, label: "加入的圈子" },
          { key: "groups" as const, label: "加入的群聊" },
        ]
      : []),
    ...(hasPermission("MODERATION_MANAGE")
      ? [
          { key: "posts" as const, label: "发布的动态" },
          { key: "notes" as const, label: "用户笔记" },
        ]
      : []),
  ];
  return (
    <Card title="圈子、群聊与发布内容">
      {items.length ? (
        <>
          <Typography.Paragraph type="secondary">
            圈子和群聊展示当前加入的记录；笔记包含本人创建及收藏副本，不包含已删除的笔记。点击名称查看完整详情。
          </Typography.Paragraph>
          <Tabs
            destroyOnHidden
            items={items.map((item) => ({
              ...item,
              children: (
                <ResourceList
                  key={`${userID}-${item.key}`}
                  userID={userID}
                  kind={item.key}
                />
              ),
            }))}
          />
        </>
      ) : (
        <Typography.Text type="secondary">
          查看这些记录需要圈子管理或内容审核权限。
        </Typography.Text>
      )}
    </Card>
  );
}
