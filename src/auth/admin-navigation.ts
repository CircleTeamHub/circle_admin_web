import type { AdminPermission } from "./admin-access";
export const ADMIN_NAVIGATION: Array<{
  key: string;
  label: string;
  permission: AdminPermission;
}> = [
  { key: "/", label: "数据看板", permission: "DASHBOARD" },
  { key: "/users", label: "用户管理", permission: "USER_READ" },
  { key: "/admin-access", label: "管理员权限", permission: "ACCESS_MANAGE" },
  { key: "/community", label: "圈子与群聊", permission: "COMMUNITY_MANAGE" },
  { key: "/im", label: "会话与聊天记录", permission: "IM_READ" },
  { key: "/reports", label: "举报审核", permission: "MODERATION_MANAGE" },
  { key: "/content", label: "内容管理", permission: "MODERATION_MANAGE" },
  {
    key: "/sensitive-words",
    label: "敏感词管理",
    permission: "CONTENT_MANAGE",
  },
  { key: "/memberships", label: "VIP 管理", permission: "COMMERCE_MANAGE" },
  {
    key: "/recharge",
    label: "充值审核与收款码",
    permission: "RECHARGE_MANAGE",
  },
  {
    key: "/fancy-inventory",
    label: "靓号库存与订单",
    permission: "COMMERCE_MANAGE",
  },
  {
    key: "/fancy-numbers",
    label: "热门靓号推荐",
    permission: "COMMERCE_MANAGE",
  },
  { key: "/support-agents", label: "客服配置", permission: "SUPPORT_MANAGE" },
  { key: "/invites", label: "邀请码与邀请奖励", permission: "CONTENT_MANAGE" },
  { key: "/ads", label: "活动广告", permission: "CONTENT_MANAGE" },
  { key: "/announcements", label: "系统公告", permission: "CONTENT_MANAGE" },
  { key: "/audit-logs", label: "操作与登录日志", permission: "AUDIT_READ" },
  { key: "/system", label: "系统状态", permission: "DASHBOARD" },
];
