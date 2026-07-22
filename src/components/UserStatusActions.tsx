import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Input, Modal, Space, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { updateUserStatus } from "../api/users";
import type {
  AdminUpdateUserStatusPayload,
  AuthUser,
  UserStatus,
} from "../types";
import { getErrorMessage } from "../utils/errors";

export function allowedUserStatusTargets(status: UserStatus): UserStatus[] {
  if (status === "ACTIVE") return ["BANNED", "DELETED"];
  if (status === "BANNED") return ["ACTIVE", "DELETED"];
  return [];
}

const ACTION_LABEL: Record<UserStatus, string> = {
  ACTIVE: "解封",
  BANNED: "封禁",
  DELETED: "删除",
};

interface UserStatusActionsProps {
  userId: string;
  accountId: string;
  status: UserStatus;
  currentUser: AuthUser;
}

export function UserStatusActions({
  userId,
  accountId,
  status,
  currentUser,
}: UserStatusActionsProps) {
  const queryClient = useQueryClient();
  const [targetStatus, setTargetStatus] = useState<UserStatus | null>(null);
  const [reason, setReason] = useState("");
  const [confirmationAccountId, setConfirmationAccountId] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [confirmationError, setConfirmationError] = useState(false);
  const currentUserId = currentUser.userId || currentUser.id;
  const isSelf = currentUserId === userId;

  const closeModal = () => {
    setTargetStatus(null);
    setReason("");
    setConfirmationAccountId("");
    setReasonError(false);
    setConfirmationError(false);
  };

  // 详情页路由在 /users/:userId 之间切换时不会卸载本组件，
  // 未重置的弹窗会把上一个用户的操作原因提交到新用户身上。
  useEffect(() => {
    return () => {
      setTargetStatus(null);
      setReason("");
      setConfirmationAccountId("");
      setReasonError(false);
      setConfirmationError(false);
    };
  }, [userId]);

  const mutation = useMutation({
    mutationFn: (payload: AdminUpdateUserStatusPayload) =>
      updateUserStatus(userId, payload),
    onSuccess: async () => {
      closeModal();
      message.success("用户状态已更新");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-user", userId] }),
        queryClient.invalidateQueries({
          queryKey: ["admin-user-audit", userId],
        }),
      ]);
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "用户状态更新失败"));
    },
  });

  const confirm = () => {
    if (!targetStatus) return;
    const normalizedReason = reason.trim();
    const invalidReason =
      normalizedReason.length < 3 || normalizedReason.length > 500;
    const invalidConfirmation =
      targetStatus === "DELETED" && confirmationAccountId !== accountId;
    setReasonError(invalidReason);
    setConfirmationError(invalidConfirmation);
    if (invalidReason || invalidConfirmation) return;

    mutation.mutate({
      status: targetStatus,
      reason: normalizedReason,
      ...(targetStatus === "DELETED" ? { confirmationAccountId } : {}),
    });
  };

  const targets = allowedUserStatusTargets(status);
  if (targets.length === 0) {
    return <Alert type="info" showIcon message="已删除账号不可恢复" />;
  }

  return (
    <>
      <Space wrap>
        {targets.map((target) => (
          <Button
            key={target}
            aria-label={ACTION_LABEL[target]}
            danger={target === "BANNED" || target === "DELETED"}
            disabled={isSelf && (target === "BANNED" || target === "DELETED")}
            onClick={() => setTargetStatus(target)}
          >
            {ACTION_LABEL[target]}
          </Button>
        ))}
      </Space>
      {isSelf ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          当前管理员不能封禁或删除自己的账号。
        </Typography.Paragraph>
      ) : null}
      <Modal
        title={targetStatus ? `确认${ACTION_LABEL[targetStatus]}用户` : "状态操作"}
        open={targetStatus !== null}
        okText="确认操作"
        cancelText="取消"
        confirmLoading={mutation.isPending}
        destroyOnHidden
        onOk={confirm}
        onCancel={closeModal}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Input.TextArea
            aria-label="操作原因"
            placeholder="客服工单号或操作原因"
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
              请输入 3 到 500 个字符的操作原因
            </Typography.Text>
          ) : null}
          {targetStatus === "DELETED" ? (
            <>
              <Typography.Text>
                删除不可恢复。请输入目标用户的完整账号 ID：{accountId}
              </Typography.Text>
              <Input
                aria-label="确认账号 ID"
                value={confirmationAccountId}
                status={confirmationError ? "error" : undefined}
                onChange={(event) => {
                  setConfirmationAccountId(event.target.value);
                  setConfirmationError(false);
                }}
              />
              {confirmationError ? (
                <Typography.Text type="danger">
                  请输入目标用户的完整账号 ID：{accountId}
                </Typography.Text>
              ) : null}
            </>
          ) : null}
        </Space>
      </Modal>
    </>
  );
}
