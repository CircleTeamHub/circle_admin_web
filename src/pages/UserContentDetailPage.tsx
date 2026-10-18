import type { AdminCirclePost } from "../api/community";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Collapse,
  Descriptions,
  Empty,
  Image,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { Fragment, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getUserNote,
  getUserPost,
  type NoteMedia,
  type AdminNoteDetail,
} from "../api/user-resources";
import { useAdminAccess } from "../auth/admin-access";
import { PageError } from "../components/PageError";
import { Identifier } from "../components/ReadableValue";
import { Post } from "./CircleDetailPage";
import { noteStatus } from "./UserResourcesCard";
export function safeContentURL(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function richContent(value: unknown, depth = 0): ReactNode {
  if (depth > 30 || value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((child, index) => (
      <Fragment key={index}>{richContent(child, depth + 1)}</Fragment>
    ));
  const block = object(value);
  const text = typeof block.text === "string" ? block.text : null;
  if (text != null) {
    const styles = object(block.styles);
    return (
      <span
        style={{
          fontWeight: styles.bold ? "bold" : undefined,
          fontStyle: styles.italic ? "italic" : undefined,
          textDecoration: styles.strike
            ? "line-through"
            : styles.underline
              ? "underline"
              : undefined,
        }}
      >
        {text}
      </span>
    );
  }
  const children = (
    <>
      {richContent(block.content, depth + 1)}
      {richContent(block.children, depth + 1)}
      {richContent(block.rows, depth + 1)}
      {richContent(block.cells, depth + 1)}
    </>
  );
  if (block.type === "link") {
    const href = safeContentURL(block.href);
    return href ? (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : (
      children
    );
  }
  if (block.type === "heading")
    return <Typography.Title level={4}>{children}</Typography.Title>;
  if (block.type === "bulletListItem" || block.type === "numberedListItem")
    return <div>• {children}</div>;
  return (
    <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {children}
    </div>
  );
}
function Media({ media }: { media: NoteMedia }) {
  const url = safeContentURL(media.url);
  if (!url)
    return <Typography.Text type="secondary">媒体暂不可用</Typography.Text>;
  if (media.type === "IMAGE")
    return <Image width={200} src={url} alt="笔记图片" />;
  if (media.type === "VIDEO")
    return (
      <video
        controls
        preload="metadata"
        src={url}
        poster={safeContentURL(media.posterUrl)}
        style={{ maxWidth: "100%", width: 400 }}
      />
    );
  if (media.type === "AUDIO")
    return <audio controls preload="metadata" src={url} />;
  return <Typography.Text>未识别的媒体类型</Typography.Text>;
}
function NoteBody({ note }: { note: AdminNoteDetail }) {
  const { hasPermission } = useAdminAccess();
  const sections = note.sections ?? {};
  const contentJson = sections.text?.contentJson ?? note.contentJson;
  const text = sections.text?.content ?? note.content;
  const media = [
    ...note.media,
    ...(sections.media?.items ?? []),
    ...(sections.showcase?.items ?? []),
    ...(sections.audio?.items ?? []),
  ];
  const uniqueMedia = [
    ...new Map(
      media.map((item) => [item.objectKey || item.url, item]),
    ).values(),
  ];
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card
        title={note.title || "未命名笔记"}
        extra={<Tag>{noteStatus(note.status)}</Tag>}
      >
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            {
              key: "created",
              label: "创建时间",
              children: new Date(note.createdAt).toLocaleString("zh-CN"),
            },
            {
              key: "updated",
              label: "更新时间",
              children: new Date(note.updatedAt).toLocaleString("zh-CN"),
            },
            {
              key: "available",
              label: "可用状态",
              children: note.available ? "可用" : "不可用",
            },
            {
              key: "work",
              label: "工作状态",
              children:
                note.workStatus === "WORKING"
                  ? "工作中"
                  : note.workStatus === "CLOSED"
                    ? "已关闭"
                    : note.workStatus
                      ? "未识别状态"
                      : "未设置",
            },
            {
              key: "groups",
              label: "笔记分组",
              children: note.groups.length
                ? note.groups.map((g) => g.name).join("、")
                : "未分组",
            },
          ]}
        />
      </Card>
      <Card title="笔记正文">
        {contentJson?.length ? (
          richContent(contentJson)
        ) : text ? (
          <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Typography.Paragraph>
        ) : (
          <Empty description="未填写文字内容" />
        )}
      </Card>
      {uniqueMedia.length > 0 && (
        <Card title="图片、视频与音频">
          <Image.PreviewGroup>
            <Space wrap align="start">
              {uniqueMedia.map((item, index) => (
                <Media key={index} media={item} />
              ))}
            </Space>
          </Image.PreviewGroup>
        </Card>
      )}
      {!!sections.contacts?.items.length && (
        <Card title="联系人名片">
          <Space wrap>
            {sections.contacts.items.map((card) =>
              hasPermission("USER_READ") ? (
                <Link
                  key={card.id}
                  to={`/users/${encodeURIComponent(card.id)}`}
                >
                  {card.name}
                </Link>
              ) : (
                <span key={card.id}>{card.name}</span>
              ),
            )}
          </Space>
        </Card>
      )}
      {!!sections.groups?.items.length && (
        <Card title="群聊与圈子名片">
          <Space wrap>
            {sections.groups.items.map((card) =>
              hasPermission("COMMUNITY_MANAGE") &&
              (card.circleId || card.conversationID) ? (
                <Link
                  key={card.id}
                  to={
                    card.circleId
                      ? `/community/circles/${encodeURIComponent(card.circleId)}`
                      : `/community/groups/${encodeURIComponent(card.conversationID!)}`
                  }
                >
                  {card.name}
                </Link>
              ) : (
                <span key={card.id}>{card.name}</span>
              ),
            )}
          </Space>
        </Card>
      )}
      {sections.location && (
        <Card title="位置信息">
          <Descriptions
            column={1}
            items={[
              {
                key: "title",
                label: "名称",
                children: sections.location.title || "未填写",
              },
              {
                key: "address",
                label: "地址",
                children: sections.location.address || "未填写",
              },
              {
                key: "coordinates",
                label: "经纬度",
                children:
                  sections.location.latitude != null &&
                  sections.location.longitude != null
                    ? `${sections.location.latitude}, ${sections.location.longitude}`
                    : "未设置",
              },
            ]}
          />
        </Card>
      )}
      {note.remark && (
        <Card title="作者备注">
          <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
            {note.remark}
          </Typography.Paragraph>
        </Card>
      )}
      <Collapse
        items={[
          {
            key: "id",
            label: "内部编号（排查使用）",
            children: <Identifier value={note.id} inline />,
          },
        ]}
      />
    </Space>
  );
}
export function UserContentDetailPage({ kind }: { kind: "posts" | "notes" }) {
  const { userId = "", resourceId = "" } = useParams();
  const q = useQuery<AdminCirclePost | AdminNoteDetail>({
    queryKey: ["user-content-detail", userId, kind, resourceId],
    queryFn: () =>
      kind === "notes"
        ? getUserNote(userId, resourceId)
        : getUserPost(userId, resourceId),
    enabled: !!userId && !!resourceId,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const back = (
    <Link to={`/users/${encodeURIComponent(userId)}`}>返回用户详情</Link>
  );
  if (q.isError)
    return (
      <Space orientation="vertical">
        {back}
        <PageError error={q.error} onRetry={() => q.refetch()} />
      </Space>
    );
  if (q.isPending) return <Spin aria-label="正在加载内容详情" />;
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      {back}
      <Typography.Text type="secondary">
        本次内容查看已记录管理员审计日志。
      </Typography.Text>
      {"title" in q.data ? <NoteBody note={q.data} /> : <Post post={q.data} />}
    </Space>
  );
}
