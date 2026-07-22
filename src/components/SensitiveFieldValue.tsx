import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Space, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { revealSensitiveField } from "../api/users";
import type { SensitiveField } from "../types";
import { getErrorMessage } from "../utils/errors";

// 服务端 sensitive-access 的明文窗口固定为 60 秒，这里同时用作兜底和上限。
const REVEAL_WINDOW_MS = 60_000;

// revealedAt 和 expiresAt 都由服务端签发，两者相减得到的窗口不受管理员工作站
// 时钟偏移影响；再按 REVEAL_WINDOW_MS 封顶，任何异常响应都不会让明文长期留在 DOM 里。
function revealWindowMs(revealedAt: string, expiresAt: string): number {
  const start = Date.parse(revealedAt);
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return REVEAL_WINDOW_MS;
  return Math.min(Math.max(0, end - start), REVEAL_WINDOW_MS);
}

interface SensitiveFieldValueProps {
  userId: string;
  field: SensitiveField;
  label: string;
  maskedValue: string | null;
}

export function SensitiveFieldValue({
  userId,
  field,
  label,
  maskedValue,
}: SensitiveFieldValueProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReveal = () => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    setRevealedValue(null);
    setIsRevealed(false);
  };

  // 详情页路由在 /users/:userId 之间切换时不会卸载本组件，
  // 因此必须按 userId/field 收回明文，否则会显示在错误的用户名下。
  useEffect(() => {
    return () => {
      clearReveal();
      setModalOpen(false);
      setReason("");
      setReasonError(false);
    };
  }, [userId, field]);

  const confirmReveal = async () => {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3 || normalizedReason.length > 500) {
      setReasonError(true);
      return;
    }

    setLoading(true);
    try {
      const response = await revealSensitiveField(userId, {
        field,
        reason: normalizedReason,
      });
      clearReveal();
      setRevealedValue(response.value);
      setIsRevealed(true);
      expiryTimer.current = setTimeout(
        clearReveal,
        revealWindowMs(response.revealedAt, response.expiresAt),
      );
      setModalOpen(false);
      setReason("");
      setReasonError(false);
      // 本次查看已写入审计记录，主动让详情页的「最近 Admin 操作」重新拉取
      // （应用关闭了窗口聚焦重取）。刷新失败由该卡片自己的错误态呈现，
      // 不影响这次已经成功的明文查看。
      void queryClient.invalidateQueries({
        queryKey: ["admin-user-audit", userId],
      });
    } catch (error) {
      message.error(getErrorMessage(error, "敏感信息查看失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Space>
        <Typography.Text>{label}</Typography.Text>
        <Typography.Text code>
          {isRevealed ? revealedValue || "-" : maskedValue || "-"}
        </Typography.Text>
        <Button size="small" onClick={() => setModalOpen(true)}>
          查看原文
        </Button>
      </Space>
      <Modal
        title={`查看${label}原文`}
        open={modalOpen}
        okText="确认查看"
        cancelText="取消"
        confirmLoading={loading}
        destroyOnHidden
        onOk={confirmReveal}
        onCancel={() => {
          setModalOpen(false);
          setReason("");
          setReasonError(false);
        }}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            本次查看会写入审计记录，请填写客服工单号或业务原因。
          </Typography.Text>
          <Input.TextArea
            aria-label="查看原因"
            rows={4}
            maxLength={500}
            showCount
            value={reason}
            status={reasonError ? "error" : undefined}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(false);
            }}
          />
          {reasonError ? (
            <Typography.Text type="danger">
              请输入 3 到 500 个字符的查看原因
            </Typography.Text>
          ) : null}
        </Space>
      </Modal>
    </>
  );
}
