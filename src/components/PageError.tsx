import { useAdminAccess } from "../auth/admin-access";
import { ApiError } from "../api/client";
import { Alert, Button, Space } from "antd";
import { readableErrorMessage } from "../utils/error-display";
import { Identifier } from "./ReadableValue";

export function PageError({
  error,
  onRetry,
  message = "加载失败",
}: {
  error: unknown;
  onRetry?: () => void;
  message?: string;
}) {
  const { hasPermission } = useAdminAccess();
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      description={
        <Space orientation="vertical">
          <span>{readableErrorMessage(error)}</span>
          {error instanceof ApiError && (
            <>
              <span>请求状态：HTTP {error.status}</span>
              {error.requestId && (
                <Identifier value={error.requestId} label="诊断编号" />
              )}
            </>
          )}
          {error instanceof ApiError && error.requestId && hasPermission("AUDIT_READ") && (
            <a
              href={`/diagnostics?requestID=${encodeURIComponent(error.requestId)}`}
            >
              查看问题排查
            </a>
          )}
        </Space>
      }
      action={
        onRetry ? (
          <Button size="small" danger onClick={onRetry}>
            重试
          </Button>
        ) : undefined
      }
    />
  );
}
