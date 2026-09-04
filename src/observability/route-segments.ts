// 由路由表 (src/app/App.tsx) 与 API 字面路径 (src/api/*.ts) 派生的静态路径段白名单。
//
// 为什么要有这份清单，而不是用「看起来像不像标识符」的正则判断：
// 后端 id 是**不透明**的。community.ts 会请求
// `/admin/community/circles/${encodeURIComponent(id)}/${action}`，一个纯字母的
// circle id（如 privatecircle）用任何字符类规则都无法与真正的静态段区分开 ——
// 只要靠猜，就一定会把某类 id 原样发给 Sentry。而 sanitizeEvent 是刻意不带任何
// 账号标识的，从路径把标识符漏回去等于绕过那个决定。
//
// 所以判定翻转成白名单：**只有出现在路由表 / API 字面路径里的段才保留**，其余一律
// `:id`。新增页面或接口后必须同步这份清单，否则新段会退化成 `:id`（只丢分组粒度，
// 不会泄漏）；反过来，清单里多出一个已不存在的词则可能与某个 id 撞车 ——
// route-segments.test.ts 会扫描 App.tsx 与 src/api/*.ts，把两个方向的漂移都钉住。
//
// 与移动端 src/observability/route-segments.ts 同一决定。
export const STATIC_ROUTE_SEGMENTS: ReadonlySet<string> = new Set([
  // API 前缀 (src/api/client.ts 的 API_BASE_URL 默认值)
  "api",
  "v1",
  // 页面路由 (src/app/App.tsx)
  "community",
  "fancy-numbers",
  "login",
  "reports",
  "support-agents",
  "support-recharge",
  "system",
  "users",
  // API 路径 (src/api/*.ts)；disable / restore 是 community.ts circleAction 插进模板的动作名
  "admin",
  "agents",
  "approve",
  "assets",
  "audit-logs",
  "auth",
  "avatar-frames",
  "circles",
  "dashboard",
  "disable",
  "enabled",
  "friend-reports",
  "grants",
  "groups",
  "health",
  "mall",
  "me",
  "operations",
  "order",
  "orders",
  "outbox",
  "payment-codes",
  "presign",
  "recharge",
  "recommendations",
  "refresh",
  "reject",
  "restore",
  "review",
  "revoke",
  "sensitive-access",
  "status",
  "support",
  "upload",
]);
