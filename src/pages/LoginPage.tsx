import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { getMe, login } from "../api/auth";
import { clearSession, setSession } from "../auth/session";

export function LoginPage() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const tokens = await login(values);
      setSession(tokens);
      const me = await getMe();
      if (me.role !== "ADMIN" || me.status !== "ACTIVE") {
        clearSession();
        throw new Error("无权限访问后台");
      }
      return me;
    },
    onSuccess: () => navigate("/", { replace: true }),
  });

  return (
    <main className="login-page">
      <Card className="login-card">
        <Typography.Title level={3}>Circle Admin</Typography.Title>
        <Typography.Paragraph type="secondary">管理员登录</Typography.Paragraph>
        {mutation.error ? (
          <Alert
            type="error"
            showIcon
            message={mutation.error instanceof Error ? mutation.error.message : "登录失败"}
          />
        ) : null}
        <Form layout="vertical" onFinish={(values) => mutation.mutate(values)}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending} block>
            登录
          </Button>
        </Form>
      </Card>
    </main>
  );
}
