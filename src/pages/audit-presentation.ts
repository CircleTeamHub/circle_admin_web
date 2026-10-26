import { DISPLAY_LABELS } from "../utils/display";
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  ADMIN_USER_NOTE_VIEWED: "查看用户笔记",
  ADMIN_USER_POST_VIEWED: "查看用户动态",
  USER_SENSITIVE_FIELD_VIEWED: "查看用户敏感资料",
  USER_BANNED: "封禁用户",
  USER_UNBANNED: "解除用户封禁",
  USER_DELETED: "注销用户",
  ADMIN_CIRCLE_STATE_CHANGED: "调整圈子状态",
  ADMIN_GROUP_OPERATION_FAILED: "群管理操作失败",
  ADMIN_GROUP_OPERATION_QUEUED: "群管理操作已排队",
  ADMIN_GROUP_OPERATION_SUCCEEDED: "群管理操作完成",
  FANCY_NUMBER_BATCH_CREATE: "批量添加靓号",
  FANCY_NUMBER_RECOMMENDATIONS_ADDED: "添加热门靓号推荐",
  FANCY_NUMBER_RECOMMENDATIONS_REORDERED: "调整靓号推荐顺序",
  IM_CIRCLE_MEMBER_REMOVED: "移除圈子群成员",
  IM_CIRCLE_MEMBER_ROLE_UNCHANGED: "群成员角色无需变更",
  IM_MESSAGES_READ: "查询聊天记录",
  IM_MEMBER_MUTE: "禁言群成员",
  IM_MEMBER_UNMUTE: "解除群成员禁言",
  IM_MEMBER_REMOVE: "移除群成员",
  IM_MEMBER_ROLE: "调整群成员角色",
  "admin_access.update": "编辑管理员资料",
  avatar_frame_grant_created: "授权用户头像框",
  avatar_frame_grant_revoked: "撤销用户头像框",
  "console.key.read": "通过自动化密钥读取后台数据",
  group_report_review: "审核群聊举报",
  post_report_review: "审核帖子举报",
  post_restore: "恢复帖子",
  post_takedown: "下架帖子",
  "sensitive_word.add": "添加敏感词",
  "sensitive_word.remove": "移除敏感词",
  "support.agents.replace": "更新客服配置",
  "support.recharge.order.approve": "通过充值审核",
  "support.recharge.order.reject": "驳回充值审核",
  "support.recharge.payment_code.set_enabled": "调整收款码启用状态",
  "admin.account.create": "新增管理员",
  "admin.account.delete": "删除管理员",
  "admin.password.reset": "重置管理员密码",
  "admin.nickname.update": "修改管理员昵称",
  system_announcement_publish: "发布系统公告",
  system_announcement_edit: "编辑系统公告",
  system_announcement_delete: "删除系统公告",
  system_announcement_scrolling_update: "修改公告滚动播报设置",

  "admin.login.success": "管理员登录成功",
  "admin.login.failed": "管理员登录失败",
  "admin.logout": "管理员退出登录",
  "console.request.failed": "后台请求失败",
  GROUP_MEMBER_ROLE_UPDATED: "调整群成员角色",
  "support.recharge.payment_code.create": "新增充值收款码",
  "support.recharge.payment_code.update": "修改充值收款码",
  "support.recharge.payment_code.delete": "删除充值收款码",
  "console.push.retry": "重试通知推送",
  "console.push.send": "发送系统通知",
  "console.push.settings": "调整推送设置",
};
export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  ...DISPLAY_LABELS.entity,
  admin_session: "管理员会话",
  http_request: "后台接口请求",
  CircleMember: "圈子成员",
  User: "用户",
  user: "用户",
  Circle: "圈子",
  circle: "圈子",
  ChatConversation: "聊天会话",
  NotificationPushOutbox: "通知推送任务",
  support_recharge_payment_code: "充值收款码",
  notification_push: "通知推送任务",
};
export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABEL[action] ?? "其他管理操作";
}
export function auditEntityLabel(type: string | null) {
  return type
    ? Object.prototype.hasOwnProperty.call(AUDIT_ENTITY_LABEL, type)
      ? AUDIT_ENTITY_LABEL[type]
      : "其他对象"
    : "未记录对象";
}

export function localDateTimeInput(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return undefined;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
