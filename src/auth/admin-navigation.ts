import type { AdminPermission } from "./admin-access";
export const ADMIN_NAVIGATION: Array<{
  key: string;
  label: string;
  permission: AdminPermission;
  additionalPermissions?: AdminPermission[];
}> = [
  { key: "/", label: "数据看板", permission: "DASHBOARD" },
  { key: "/users", label: "用户管理", permission: "USER_READ" },
  { key: "/admin-access", label: "管理员权限", permission: "ACCESS_MANAGE" },
  { key: "/community", label: "圈子管理", permission: "COMMUNITY_MANAGE" },
  { key: "/im", label: "会话与聊天记录", permission: "IM_READ" },
  { key: "/reports", label: "举报审核", permission: "MODERATION_MANAGE" },
  { key: "/content", label: "圈子内容管理", permission: "MODERATION_MANAGE" },
  {
    key: "/sensitive-words",
    label: "敏感词管理",
    permission: "CONTENT_MANAGE",
  },
  { key: "/memberships", label: "VIP和充值管理", permission: "COMMERCE_MANAGE", additionalPermissions: ["RECHARGE_MANAGE", "CONTENT_MANAGE"] },
  { key: "/support-agents", label: "客服配置", permission: "SUPPORT_MANAGE" },
  { key: "/announcements", label: "系统公告", permission: "CONTENT_MANAGE" },
  { key: "/audit-logs", label: "管理员操作记录", permission: "AUDIT_READ" },
  { key: "/push-operations", label: "通知管理", permission: "SUPPORT_MANAGE" },
  { key: "/tasks", label: "后台任务中心", permission: "DASHBOARD" },
  { key: "/releases", label: "App 版本管理", permission: "CONTENT_MANAGE" },
  { key: "/diagnostics", label: "问题排查", permission: "AUDIT_READ" },
  { key: "/user-events", label: "用户行为记录", permission: "AUDIT_READ" },
  { key: "/automation-keys", label: "自动化密钥", permission: "ACCESS_MANAGE" },
  { key: "/system", label: "系统状态", permission: "DASHBOARD" },
];
