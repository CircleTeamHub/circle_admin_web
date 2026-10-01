import { createContext, useContext } from "react";
import { Result } from "antd";

export type AdminPermission =
  | "DASHBOARD"
  | "USER_READ"
  | "USER_MODERATE"
  | "USER_SENSITIVE"
  | "COMMUNITY_MANAGE"
  | "IM_READ"
  | "IM_MODERATE"
  | "SUPPORT_MANAGE"
  | "COMMERCE_MANAGE"
  | "RECHARGE_MANAGE"
  | "MODERATION_MANAGE"
  | "CONTENT_MANAGE"
  | "AUDIT_READ"
  | "ACCESS_MANAGE";
export interface AdminAccess {
  role: string;
  permissions: AdminPermission[];
  version: number;
}
export const AdminAccessContext = createContext<AdminAccess | null>(null);
export function useAdminAccess() {
  const access = useContext(AdminAccessContext);
  return {
    access,
    hasPermission: (permission: AdminPermission) =>
      access?.permissions.includes(permission) ?? false,
  };
}
export function RequirePermission({
  permission,
  children,
}: {
  permission: AdminPermission;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAdminAccess();
  return hasPermission(permission) ? (
    <>{children}</>
  ) : (
    <Result
      status="403"
      title="当前管理员无此功能权限"
      subTitle="请联系超级管理员分配对应角色。"
    />
  );
}
