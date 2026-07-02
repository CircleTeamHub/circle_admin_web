import { Alert, Button } from "antd";
import { getErrorMessage } from "../utils/errors";

export function PageError({
  error,
  onRetry,
  message = "加载失败",
}: {
  error: unknown;
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      description={getErrorMessage(error)}
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
