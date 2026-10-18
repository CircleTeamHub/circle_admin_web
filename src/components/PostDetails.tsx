import { useQuery } from "@tanstack/react-query";
import { Collapse, Descriptions, Image, Space, Spin, Typography } from "antd";
import { Link } from "react-router-dom";
import { getPost } from "../api/moderation";
import { useAdminAccess } from "../auth/admin-access";
import { formatDateTime } from "../utils/format";
import { CodeValue, Identifier } from "./ReadableValue";
import { PageError } from "./PageError";

export function PostDetails({ postID }: { postID: string }) {
  const { hasPermission } = useAdminAccess();
  const query = useQuery({ queryKey: ["contentPost", postID], queryFn: () => getPost(postID) });
  if (query.isPending) return <Spin tip="帖子加载中…"><div style={{ minHeight: 100 }} /></Spin>;
  if (query.isError) return <PageError error={query.error} onRetry={() => query.refetch()} message="帖子内容暂不可用，可能已删除或无权查看" />;
  const post = query.data;
  const authorName = post.author.nickname || post.author.accountId || "未设置昵称";
  return (
    <Space orientation="vertical" size={20} style={{ width: "100%" }}>
      <Descriptions column={1} size="small" bordered items={[
        { key: "author", label: "作者", children: <Space wrap>{hasPermission("USER_READ") ? <Link to={`/users/${encodeURIComponent(post.author.id)}`}>{authorName}</Link> : authorName}<Typography.Text type="secondary">账号 ID：{post.author.accountId}</Typography.Text></Space> },
        { key: "circle", label: "所属圈子", children: hasPermission("COMMUNITY_MANAGE") ? <Link to={`/community/circles/${encodeURIComponent(post.circle.id)}`}>{post.circle.name}</Link> : post.circle.name },
        { key: "status", label: "帖子状态", children: <CodeValue domain="contentStatus" value={post.status} /> },
        { key: "created", label: "发布时间", children: formatDateTime(post.createdAt) },
        { key: "signups", label: "报名人数", children: `${post.signupCount} 人` },
      ]} />
      <div>
        <Typography.Title level={5}>帖子正文</Typography.Title>
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.content || "该帖子没有文字内容"}</Typography.Paragraph>
      </div>
      {post.images.length > 0 && <div>
        <Typography.Title level={5}>帖子图片</Typography.Title>
        <Image.PreviewGroup><Space wrap align="start">{post.images.map((url, index) => /^https?:\/\//i.test(url) ? <Image key={`${index}-${url}`} src={url} width={160} height={160} style={{ objectFit: "cover", borderRadius: 8 }} alt={`帖子图片 ${index + 1}`} /> : <Typography.Text key={index} type="secondary">图片 {index + 1} 暂不可用</Typography.Text>)}</Space></Image.PreviewGroup>
      </div>}
      {post.tags.length > 0 && <Typography.Text type="secondary">标签：{post.tags.join("、")}</Typography.Text>}
      <Collapse size="small" items={[{key: "ids", label: "内部编号（排查用）", children: <Identifier value={post.id} inline />}]} />
    </Space>
  );
}
