import type { Task } from "../api/console";

const NOTIFICATION_LABEL: Record<string, string> = {
  SQUAD_REQUEST_RECEIVED: "收到小队申请",
  SQUAD_REQUEST_ACCEPTED: "小队申请已通过",
  SQUAD_REQUEST_REJECTED: "小队申请被拒绝",
  FRIEND_REQUEST_RECEIVED: "收到好友申请",
  FRIEND_REQUEST_ACCEPTED: "好友申请已通过",
  FRIEND_REQUEST_REJECTED: "好友申请被拒绝",
  FRIEND_REQUEST_MESSAGE: "好友申请留言",
  SYSTEM: "系统通知",
  GROUP_ADMISSION: "群聊入群通知",
  CIRCLE_INVITATION_RECEIVED: "收到圈子邀请",
  TRACE_LIKE: "动态获赞",
  TRACE_COMMENT: "动态收到评论",
  COMMENT_REPLY: "评论收到回复",
  TRACE_MENTION: "动态提及你",
  CIRCLE_VERIFICATION_REQUESTED: "圈子邀请待验证",
  CIRCLE_INVITATION_APPROVED: "圈子邀请已通过",
  CIRCLE_INVITATION_REJECTED: "圈子邀请被拒绝",
  CIRCLE_ADMIN_OVERRIDE_APPROVED: "管理员批准入圈",
  CIRCLE_POST_PUBLISHED: "圈子发布新帖子",
  CIRCLE_POST_SIGNUP_CREATED: "圈子帖子收到报名",
  CIRCLE_POST_AUTO_ENDED: "圈子帖子自动结束",
  CIRCLE_POST_COLLABORATION_RECOGNIZED: "圈子协作获认可",
  PROFILE_LIKE: "个人主页获赞",
};
export function notificationLabel(type?: string) {
  return type
    ? (NOTIFICATION_LABEL[type] ?? `其他通知（${type}）`)
    : "通知记录不可用";
}
export function nextTaskAttempt(task: Pick<Task, "status" | "nextAttemptAt">) {
  return ["COMPLETED", "TERMINAL"].includes(task.status)
    ? null
    : task.nextAttemptAt;
}
export function taskResult(task: Task) {
  if (task.completionReason === "ANNOUNCEMENT_DELETED") return "公告已删除，未投递部分已停止";
  const counts = task.deliveryCounts;
  if (counts) {
    const labels: Record<string, string> = {
      PENDING: "待投递",
      SENT: "渠道已接受",
      CONFIRMED: "回执记录",
      FAILED: "投递失败",
      TERMINAL: "投递终止",
    };
    const summary = Object.entries(labels)
      .filter(([key]) => counts[key] > 0)
      .map(([key, label]) => `${label} ${counts[key]} 条`)
      .join("；");
    if (summary) return summary;
    if (task.status === "COMPLETED") {
      if (task.completionReason === "NO_ACTIVE_DEVICE")
        return "未发送：当时没有可用的推送设备";
      if (task.completionReason === "CIRCLE_PUSH_DISABLED")
        return "已跳过：用户关闭了圈子离线提醒";
      return "历史投递结果无法确认（无投递明细）";
    }
  }
  const results: Record<string, string> = {
    PENDING: "等待后台处理",
    PROCESSING: "后台正在处理",
    COMPLETED: "后台处理完成",
    FAILED: "本次处理失败，等待重试",
    TERMINAL: "已停止处理，不再自动重试",
  };
  return results[task.status] ?? "结果待确认";
}
