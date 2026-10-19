import { ApiError } from "../api/client";
import { DISPLAY_LABELS } from "../utils/display";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Input, Modal, Space, Typography, message } from "antd";
import { useSearchParams } from "react-router-dom";
import { consoleWrite } from "../api/console";
import { PageError } from "../components/PageError";

export const STATUS: Record<string, string> = {
  PENDING: "待处理",
  PROCESSING: "处理中",
  COMPLETED: "已完成",
  SUCCEEDED: "执行成功",
  FAILED: "失败",
  TERMINAL: "终止",
  SENT: "渠道已接受",
  CONFIRMED: "回执已记录",
};
export const EVENT_LABEL: Record<string, string> = DISPLAY_LABELS.event;
export const QUEUE_LABEL: Record<string, string> = {
  notification_push: "通知推送",
  group_operation: "群管理操作",
  session_revocation: "账号会话吊销",
  chat_direct_auto_reply: "私聊自动回复",
  chat_support_recharge: "客服充值处理",
  friend_chat_replay: "好友消息补投",
  gift_card: "转账凭证补投",
  verification_card: "邀请验证卡片",
};

export function useConsoleFilters() {
  const [search, setSearch] = useSearchParams();
  const set = (patch: Record<string, string | undefined>) =>
    setSearch((prev) => {
      const next = new URLSearchParams(prev);
      if (!("cursor" in patch)) next.delete("cursor");
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  return { search, set };
}
export function Pager({ nextCursor }: { nextCursor?: string | null }) {
  const { search, set } = useConsoleFilters();
  return (
    <Space>
      <Button
        disabled={!search.get("cursor")}
        onClick={() => set({ cursor: undefined })}
      >
        首页
      </Button>
      <Button
        disabled={!nextCursor}
        onClick={() => set({ cursor: nextCursor ?? undefined })}
      >
        下一页
      </Button>
    </Space>
  );
}
export function ReasonAction({
  title,
  path,
  payload,
  method = "POST",
  danger = false,
  confirmText,
  onDone,
}: {
  title: string;
  path: string;
  payload: Record<string, unknown>;
  method?: string;
  danger?: boolean;
  confirmText?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [typed, setTyped] = useState("");
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      const body = { ...payload, reason: reason.trim() },
        fingerprint = JSON.stringify({ path, body, method });
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { fingerprint, key: crypto.randomUUID() };
      return consoleWrite(path, body, pending.current.key, method);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) void client.invalidateQueries({ queryKey: ["console"] });
    },
    onSuccess: () => {
      pending.current = null;
      setOpen(false);
      setReason("");
      setTyped("");
      message.success("操作已受理，请查看实际处理状态");
      void client.invalidateQueries({ queryKey: ["console"] });
      onDone?.();
    },
  });
  return (
    <>
      <Button
        danger={danger}
        onClick={() => {
          setOpen(true);
          mutation.reset();
        }}
      >
        {title}
      </Button>
      <Modal
        title={title}
        open={open}
        onCancel={() => !mutation.isPending && setOpen(false)}
        onOk={() => mutation.mutate()}
        confirmLoading={mutation.isPending}
        okButtonProps={{
          danger,
          disabled:
            reason.trim().length < 3 ||
            (!!confirmText && typed !== confirmText),
        }}
        cancelButtonProps={{ disabled: mutation.isPending }}
        destroyOnHidden
      >
        <Typography.Paragraph>
          此操作会记录操作者、原因与诊断 ID。
        </Typography.Paragraph>
        <Input.TextArea
          aria-label="操作原因"
          placeholder="操作原因（至少 3 个字）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        {confirmText && (
          <>
            <Typography.Paragraph>
              输入 {confirmText} 确认：
            </Typography.Paragraph>
            <Input
              aria-label="确认文本"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </>
        )}
        {mutation.isError && <PageError error={mutation.error} />}
      </Modal>
    </>
  );
}
export function CollectionNotice({
  startedAt,
}: {
  startedAt: string | null | undefined;
}) {
  return (
    <Alert
      type="info"
      showIcon
      title={
        startedAt
          ? `从这里开始记录用户操作： ${new Date(startedAt).toLocaleString()}，更早的操作无法补录`
          : "还没有用户操作记录"
      }
      description="只记录事件类型与处理状态，不采集聊天正文、笔记正文或登录凭证。数据不足时不会显示为完整历史。"
    />
  );
}
