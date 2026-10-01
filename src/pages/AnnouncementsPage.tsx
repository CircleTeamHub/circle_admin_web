import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import { useRef, useState } from "react";
import { publishAnnouncement } from "../api/moderation";
import { getErrorMessage } from "../utils/errors";
import { getSession, getSessionEpoch } from "../auth/session";

const PENDING_KEY = "circle-admin-pending-announcement";
type PendingAnnouncement = { key: string; digest: string };
type AnnouncementAttempt = PendingAnnouncement & {
  content: string;
  storageKey: string;
  sessionEpoch: number;
};
function readPending(storageKey: string): PendingAnnouncement | undefined {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return undefined;
  const value = JSON.parse(raw) as PendingAnnouncement;
  if (
    !/^[0-9a-f-]{36}$/i.test(value.key) ||
    !/^[0-9a-f]{64}$/i.test(value.digest)
  )
    throw new Error("待确认公告记录无效，请联系管理员核对发布结果");
  return value;
}
async function contentDigest(content: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function AnnouncementsPage() {
  const [form] = Form.useForm<{ content: string }>();
  const [preview, setPreview] = useState<string>();
  const [result, setResult] = useState<number>();
  const attempt = useRef<AnnouncementAttempt | undefined>(undefined);
  const preparing = useRef(false);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ content, key, sessionEpoch }: AnnouncementAttempt) => {
      if (getSessionEpoch() !== sessionEpoch)
        throw new Error("登录状态已变更，请重试");
      return publishAnnouncement(content, key);
    },
    onSuccess: (response, variables) => {
      try {
        for (const storageKey of [variables.storageKey, PENDING_KEY]) {
          const pending = readPending(storageKey);
          if (
            pending?.key === variables.key &&
            pending.digest === variables.digest
          )
            sessionStorage.removeItem(storageKey);
        }
      } catch {
        if (getSessionEpoch() === variables.sessionEpoch)
          message.warning("公告已发布，但待确认记录清理失败，请联系管理员");
      }
      if (getSessionEpoch() !== variables.sessionEpoch) return;
      setResult(response.createdCount);
      setPreview(undefined);
      form.resetFields();
      attempt.current = undefined;
    },
    onError: (error, variables) => {
      if (getSessionEpoch() !== variables.sessionEpoch) return;
      message.error(
        getErrorMessage(error, "发布失败；再次确认会使用同一个请求标识重试"),
      );
    },
  });
  return (
    <Space direction="vertical" className="page-stack" size={16}>
      <Typography.Title level={3}>系统公告</Typography.Title>
      <Typography.Paragraph>
        公告发送给活跃用户。返回数量表示创建的站内通知数量。
      </Typography.Paragraph>
      {result !== undefined && (
        <Alert type="success" message={`已创建 ${result} 条站内通知`} />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={({ content }) => {
          setPreview(content.trim());
        }}
      >
        <Form.Item
          name="content"
          label="公告正文"
          rules={[{ required: true, whitespace: true }, { max: 5000 }]}
        >
          <Input.TextArea
            rows={10}
            maxLength={5000}
            showCount
            disabled={mutation.isPending || !!attempt.current}
          />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          发布失败后保留请求标识。返回此页面或刷新后，请重新输入完全相同的正文重试；待确认结果核对前无法发布不同正文。
        </Typography.Paragraph>
        <Button
          type="primary"
          htmlType="submit"
          disabled={mutation.isPending || preparingPreview}
        >
          预览并确认
        </Button>
      </Form>
      <Modal
        title="确认向活跃用户发布公告"
        open={preview !== undefined}
        confirmLoading={mutation.isPending || preparingPreview}
        onCancel={() => {
          if (!mutation.isPending && !preparing.current) setPreview(undefined);
        }}
        onOk={async () => {
          if (!preview || mutation.isPending || preparing.current) return;
          if (attempt.current && attempt.current.content !== preview) {
            message.error("上次发布结果尚未确认，请先使用原正文重试以核对结果");
            return;
          }
          preparing.current = true;
          setPreparingPreview(true);
          const sessionEpoch = getSessionEpoch();
          try {
            const tokenPart = getSession()?.accessToken.split(".")[1];
            if (!tokenPart) throw new Error("请重新登录后发布");
            const payload = JSON.parse(
              atob(tokenPart.replace(/-/g, "+").replace(/_/g, "/")),
            ) as { sub?: string };
            if (typeof payload.sub !== "string" || !payload.sub)
              throw new Error("无法确认发布账号，请重新登录");
            const [actorDigest, digest] = await Promise.all([
              contentDigest(
                JSON.stringify(["announcement-actor", payload.sub]),
              ),
              contentDigest(JSON.stringify([payload.sub, preview])),
            ]);
            if (getSessionEpoch() !== sessionEpoch)
              throw new Error("登录状态已变更，请重试");
            const storageKey = `${PENDING_KEY}:${actorDigest}`;
            const pending = readPending(storageKey);
            if (pending && pending.digest !== digest) {
              message.error("还有待确认的公告，请输入上次完全相同的正文重试");
              return;
            }
            // Preserve the old global record for its original actor/content.
            // Another actor's mismatching digest must not block their own attempt.
            const legacy = readPending(PENDING_KEY);
            const matchingLegacy =
              legacy?.digest === digest ? legacy : undefined;
            if (pending && matchingLegacy && pending.key !== matchingLegacy.key)
              throw new Error(
                "存在多个待确认发布标识，请联系管理员核对发布结果",
              );
            const key =
              pending?.key ?? matchingLegacy?.key ?? crypto.randomUUID();
            // Persist only retry identity and a digest, never the announcement body.
            sessionStorage.setItem(storageKey, JSON.stringify({ key, digest }));
            attempt.current = {
              content: preview,
              key,
              digest,
              storageKey,
              sessionEpoch,
            };
            mutation.mutate(attempt.current);
          } catch (error) {
            if (getSessionEpoch() !== sessionEpoch) return;
            message.error(
              getErrorMessage(error, "无法安全保存发布标识，公告尚未发送"),
            );
          } finally {
            preparing.current = false;
            setPreparingPreview(false);
          }
        }}
      >
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
          {preview}
        </Typography.Paragraph>
      </Modal>
    </Space>
  );
}
