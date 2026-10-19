import { ApiError } from "../api/client";
const STATUS_MESSAGE: Record<number, string> = {
  400: "请求参数不符合要求，请检查筛选条件或表单内容。",
  401: "登录已失效，请重新登录。",
  403: "当前账号没有执行此操作的权限。",
  404: "目标记录不存在或已不可用。",
  409: "数据状态已变化，请刷新后重试。",
  429: "访问过于频繁，请稍后重试。",
};
export function readableErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 500)
    return "服务暂时无法完成请求，请稍后重试或通过诊断编号排查。";
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (
    text.length <= 240 &&
    /[\u4e00-\u9fff]/.test(text) &&
    !/Prisma|node_modules|\bsrc\/|invocation|SELECT\s/i.test(text)
  )
    return text;
  if (error instanceof ApiError)
    return STATUS_MESSAGE[error.status] ?? "请求未完成，请稍后重试。";
  if (error instanceof TypeError)
    return "无法连接服务，请检查网络及本地后端是否已启动。";
  return "请求未完成，请稍后重试。";
}
