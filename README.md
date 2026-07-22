# Circle Admin Web

WindNote/Circle 内部管理后台，用于管理员处理用户、举报和轻量运行状态。

## 功能

- 管理员登录：使用 `/api/v1/auth/admin/login`，并校验 `role=ADMIN`、
  `status=ACTIVE` 与 ADMIN token audience。
- Dashboard：展示待处理举报、用户总数、封禁用户数、Outbox failed 摘要和运维链接。
- 举报审核：筛选并审核好友举报。
- 用户管理中心：
  - 按关键词、状态、角色和注册时间查询用户；
  - 列表与详情默认只显示遮罩后的联系方式；
  - 查看单个联系方式原文必须填写原因，操作会被审计，原文 60 秒后自动隐藏；
  - 查看账户、安全与同步、钱包及业务计数的 360 详情；
  - 按状态机封禁、解封或软删除用户，所有操作要求原因；
  - 删除要求输入目标账号 ID，管理员不能封禁或删除自己；
  - 查看最近的 Admin 审计记录。
- 系统状态：展示 `/outbox/health`、API 可达性和运维入口。

VIP 卡片当前只显示 `新的月度 VIP 系统设计中`。本版本不读取或修改旧
`vipLevel`，也不实现套餐、到期时间、支付核验、人工升级或兑换码。

## 本地开发

```bash
npm install
npm run dev
```

默认地址为 `http://127.0.0.1:5174`。Vite 将 `/api` 代理到
`http://127.0.0.1:3000`，因此联调前需要先启动后端。

## 环境变量

参考 `.env.example`：

```text
VITE_API_BASE_URL=/api/v1
VITE_APP_ENV=production
VITE_GRAFANA_URL=https://grafana.example.com
VITE_SENTRY_URL=https://sentry.example.com
VITE_UPTIME_KUMA_URL=https://uptime.example.com
VITE_ALERTMANAGER_URL=https://alertmanager.example.com
```

生产环境默认通过同域 `/api/v1` 访问后端。Admin 静态站点不承载 API 反向代理。

## 验证

```bash
npm test
npm run typecheck
npm run build
docker build -t circle-admin-web:local .
```

用户管理的重点冒烟路径是：搜索测试用户、查看遮罩详情、用工单原因查看一个敏感
字段、封禁、确认会话撤销、再解封。软删除只对可丢弃测试账号执行。

## 部署

1. 先部署 `circle_be` 的 `AdminAuditLog` 数据库迁移与 `/api/v1/admin/users` 接口。
2. 使用测试 Admin token 验证后端列表、详情、敏感查看、封禁和解封。
3. 再部署本 Admin 前端。
4. 监控 4xx/5xx、审计插入和会话撤销错误。

镜像采用 `node:22-alpine` 构建、`nginx:alpine` 运行。生产发布使用
`Dockerfile.release`。建议部署在 `admin.<domain>`，并在外层开启 Cloudflare
Access、VPN 或 IP allowlist。

## 当前限制

- 当前只接入好友举报；群举报、内容治理和钱包人工调整仍需要独立 Admin API。
- 第一版继续使用统一 `ADMIN` 角色，尚未拆分客服、审核、财务或只读权限。
