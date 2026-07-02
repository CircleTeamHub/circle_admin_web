import { Button, Result } from "antd";
import { Navigate, useNavigate } from "react-router-dom";
import { clearSession } from "./session";
import type { AuthUser } from "../types";

interface RequireAdminProps {
  user: AuthUser | null;
  children: React.ReactNode;
}

export function RequireAdmin({ user, children }: RequireAdminProps) {
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "ADMIN" || user.status !== "ACTIVE") {
    return (
      <Result
        status="403"
        title="无权限访问后台"
        subTitle="当前账号不是可用的管理员账号。"
        extra={
          <Button
            type="primary"
            onClick={() => {
              clearSession();
              navigate("/login", { replace: true });
            }}
          >
            重新登录
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
