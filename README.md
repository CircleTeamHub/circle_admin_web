# Circle Admin Web

Circle 管理后台，用于内部管理员处理举报、管理用户状态、查看轻量系统状态。

## 功能

- 管理员登录：调用后端 `/api/v1/auth/login`，登录后校验 `/auth/me` 返回的 `role=ADMIN` 且 `status=ACTIVE`。
- Dashboard：展示待处理举报数、用户总数、封禁用户数、Outbox failed 摘要和运维链接。
- 举报审核：按 `PENDING / APPROVED / REJECTED` 筛选好友举报，查看详情，通过或驳回举报。
- 用户管理：按 accountId 搜索、按 status 筛选，支持封禁、解封、删除用户并填写操作说明。
- 系统状态：展示 `/outbox/health`、API 可达性和 Grafana/Sentry/Uptime Kuma/Alertmanager 链接。

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://127.0.0.1:5174
```

Vite dev server 会把 `/api` 代理到：

```text
http://127.0.0.1:3000
```

因此本地联调前需要启动后端服务。

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

生产环境默认通过同域 `/api/v1` 访问后端，由 Nginx 反代到 `circle_be:3000`。

## 验证

```bash
npm test
npm run typecheck
npm run build
docker build -t circle-admin-web:local .
```

## 部署

镜像使用多阶段构建：

- build stage: `node:22-alpine`
- runtime stage: `nginx:alpine`

Nginx 配置：

- SPA fallback: `try_files $uri /index.html`
- `/api/` 反代到 `http://circle_be:3000/api/`

推荐部署在 `admin.<domain>`，并在外层开启 Cloudflare Access、VPN 或 IP allowlist。

## 当前限制

- 当前登录仍复用普通 `/auth/login`，后续应增加独立 `/auth/admin/login` 和 admin token audience。
- 当前只接入好友举报；群举报、内容治理、钱包调整后续补后端接口后再接入。
- 管理操作第一版依赖后端 business log；后续应落 AdminAuditLog 审计表。
