import { Button, Image, Space, Typography } from "antd";
import { useState } from "react";
import type { ImMessage } from "../api/admin-im";
function safeUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function AdminMessageContent({
  message,
  onRenew,
  renewalPending,
}: {
  message: ImMessage;
  onRenew: () => void;
  renewalPending: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const url = safeUrl(message.content.url);
  if (message.visibleUntil && Date.parse(message.visibleUntil) <= Date.now())
    return <Typography.Text type="secondary">消息已过期</Typography.Text>;
  if (message.type === "text")
    return (
      <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {String(message.content.text ?? "")}
      </span>
    );
  const media = ["image", "voice", "video", "file"].includes(message.type);
  const expired =
    !message.mediaExpiresAt || Date.parse(message.mediaExpiresAt) <= Date.now();
  const renew = (
    <Button
      size="small"
      loading={renewalPending}
      disabled={renewalPending}
      onClick={onRenew}
    >
      重新审计查询并更新媒体
    </Button>
  );
  if (media && (expired || failed || !url))
    return (
      <Space direction="vertical">
        <Typography.Text type="secondary">
          {expired ? "媒体链接已过期" : "媒体加载失败或不可用"}
          ，需要重新审计访问。
        </Typography.Text>
        {renew}
      </Space>
    );
  const deadline =
    media && message.mediaExpiresAt ? (
      <Typography.Text type="secondary">
        链接有效至 {new Date(message.mediaExpiresAt).toLocaleTimeString()}
      </Typography.Text>
    ) : null;
  if (url && message.type === "image")
    return (
      <Space direction="vertical">
        <Image
          width={160}
          src={url}
          referrerPolicy="no-referrer"
          preview={false}
          onError={() => setFailed(true)}
        />
        {deadline}
        {renew}
      </Space>
    );
  if (url && message.type === "voice")
    return (
      <Space direction="vertical">
        <audio
          controls
          preload="none"
          src={url}
          onError={() => setFailed(true)}
        />
        {deadline}
        {renew}
      </Space>
    );
  if (url && message.type === "video")
    return (
      <Space direction="vertical">
        <video
          controls
          preload="none"
          width={240}
          src={url}
          onError={() => setFailed(true)}
        />
        {deadline}
        {renew}
      </Space>
    );
  if (url && message.type === "file")
    return (
      <Space direction="vertical">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (
              !message.mediaExpiresAt ||
              Date.parse(message.mediaExpiresAt) <= Date.now()
            ) {
              e.preventDefault();
              setFailed(true);
            }
          }}
        >
          查看文件 {String(message.content.name ?? "")}
        </a>
        {deadline}
        <Typography.Text type="secondary">
          文件打开失败时，请重新审计更新链接。
        </Typography.Text>
        {renew}
      </Space>
    );
  return (
    <Typography.Text type="secondary">
      {message.type} · 无可显示内容或媒体不可用
    </Typography.Text>
  );
}
