# Admin console expansion implementation plan

> **For agentic workers:** Use subagent-driven-development for independent tasks and review the integrated changes before handover.

**Goal:** Deliver the missing admin functions approved by the user: IM queries, member moderation, memberships, recharge review, inventory, moderation, invitations, ads, global audit and administrator roles.

**Architecture:** Extend the existing React/Ant Design admin and NestJS backend. Keep all administrator APIs behind ADMIN audience authentication plus database backed permissions. Reuse current mutation services and their idempotency/revision contracts. Add additive database migrations for new features only; do not deploy or change production data during development.

**Tech Stack:** React 19, Ant Design 6, TanStack Query, TypeScript, NestJS 11, Prisma 7, PostgreSQL.

## Global constraints

- Web workspace: `C:/Users/93256/Desktop/WIndNote/Circle_frontend/.codex-worktrees/admin-console-expansion`.
- Backend workspace: `C:/Users/93256/Desktop/WIndNote/Circle_frontend/.codex-worktrees/backend-admin-expansion`.
- Do not add or run tests. Type checking, compilation, migration validation and code review are permitted. Report these limits accurately.
- Do not overwrite existing work in the original repositories. Do not commit, push or deploy while agents share the branches.
- Root owns schema, migrations, module registration, existing controller permission annotations, navigation, application routes, auth changes and all root platform files.
- New backend controllers use `@UseGuards(JwtGuard, AdminGuard, AdminPermissionGuard)` and `@RequireAdminPermission(...)` imported from `src/admin-access/admin-permission.guard`.
- Permission strings: `DASHBOARD`, `USER_READ`, `USER_MODERATE`, `USER_SENSITIVE`, `COMMUNITY_MANAGE`, `IM_READ`, `IM_MODERATE`, `SUPPORT_MANAGE`, `COMMERCE_MANAGE`, `RECHARGE_MANAGE`, `MODERATION_MANAGE`, `CONTENT_MANAGE`, `AUDIT_READ`, `ACCESS_MANAGE`.
- No secrets, contact details or private message content in logs. Message access requires a reason and a successful audit write before returning data.
- Bound pagination, validate DTOs, handle empty/loading/error states, preserve failed mutation forms, disable duplicate submissions and reuse stable idempotency keys on retries.
- No automatic retry of unaudited financial or external non-idempotent mutations.
- Report files live beside this plan. They must list exact changed files, API contracts, build evidence and limitations.

## Task 1: Membership, recharge and full fancy number inventory

Owner: commerce implementer. Files owned: web `src/api/admin-commerce.ts`, `src/pages/MembershipsPage.tsx`, `src/pages/FancyInventoryPage.tsx`; recharge integration reuses current main `src/pages/SupportRechargePage.tsx`; backend `src/admin-commerce/*`. Do not alter old controllers or shared files.

- [x] Read current membership schema/services/DTOs, support recharge DTOs/controllers, fancy number admin service and order models.
- [x] Add `AdminCommerceModule`: bounded GET `/admin/commerce/memberships` with account search/plan/expiry filtering and membership grant history; bounded GET `/admin/commerce/fancy-number-orders` with account/number lookup and ownership/expiry information where not already provided by inventory API. Require `COMMERCE_MANAGE`.
- [x] Create membership page listing current users' plans and expiry; permit audited activation/upgrade by the existing `/admin/memberships/users/:userId/grants` DTO and idempotency contract. Show grant history. Read plans from existing membership catalog.
- [x] Reuse the recharge page added by current main: existing payment code list/create/edit/enable, order list/status filter, approve/reject with actual DTO fields and confirmations. Use existing supported upload flow to upload a payment-code image; do not accept arbitrary private bucket keys. Never imply approval without explicit administrator confirmation of actual payment.
- [x] Create fancy inventory page: existing all-inventory list/search/status filter, batch add, available-number enable/disable; ownership, expiry and order history via new read API. Keep popular recommendations page separate.
- [x] Root will mount exports `MembershipsPage`, `SupportRechargePage`, `FancyInventoryPage` at `/memberships`, `/recharge`, `/fancy-inventory` and register `AdminCommerceModule`.
- [x] Self-review business contracts and write `task-1-report.md`. No commits or tests.

## Task 2: Reports, content, sensitive words and announcements

Owner: moderation implementer. Files owned: web `src/api/moderation.ts`, `src/pages/ReportsPage.tsx`, `src/pages/ContentPage.tsx`, `src/pages/SensitiveWordsPage.tsx`, `src/pages/AnnouncementsPage.tsx`; backend `src/admin-content/*`. Do not edit shared navigation/module/schema/auth/guards/controllers.

- [x] Extend current reports page with friend/group/post report categories using real existing backend DTOs, evidence and review behavior. Preserve original friend report handling.
- [x] Add `AdminContentModule` for a bounded searchable circle-post list/details with report counts and status; require `MODERATION_MANAGE`. Do not expose unrelated private content.
- [x] Content page shows posts and their moderation status; takedown with reason and restore using existing moderation APIs. Use confirmations and failure reconciliation.
- [x] Sensitive words page supports list/search/bulk add/bulk remove via existing API; validate bounds, show errors, explicit remove confirmation.
- [x] Announcements page publishes via existing `/admin/system-announcements` with supported fields only, preview/confirmation and stable Idempotency-Key. Show returned delivery result accurately.
- [x] Root will mount `ReportsPage` at `/reports`, `ContentPage` at `/content`, `SensitiveWordsPage` at `/sensitive-words`, `AnnouncementsPage` at `/announcements`; register `AdminContentModule`.
- [x] Self-review contracts and write `task-2-report.md`. No commits or tests.

## Task 3: IM sessions, audited message access and group members

Owner: IM implementer. Files owned: backend `src/admin-im/*`; web `src/api/admin-im.ts`, `src/pages/ImPage.tsx`, `src/pages/GroupMembersPage.tsx`, focused `src/components/AdminMessageContent.tsx` if useful. Do not alter shared files or old community APIs.

- [x] Inspect actual self-hosted/OpenIM chat source and linkage. Add `AdminImModule` with bounded searchable direct/group session list and participant summaries. Require `IM_READ`.
- [x] Add POST message query `/admin/im/conversations/:id/messages/query` with reason (2..500 chars), bounded cursor pagination, sender/date/text filters and safe serializers. Read actual persisted source; do not claim nonexistent OpenIM history is available. Hide recalled/deleted/expired burn-after-read content. Audit actor/conversation/filter metadata without message bodies before returning; fail closed if audit fails. No client cache persistence or global content search.
- [x] Add GET `/admin/im/conversations/:id/members` and administrator moderation for member mute/unmute/remove/role where current services can preserve source-of-truth consistency. Require `IM_MODERATE`, reason/confirmation and stable idempotency semantics or avoid unsafe retry. Guard against modifying owners and self operations.
- [x] IM page selects session, collects a reason explicitly before querying message content, supports pagination/media rendering/date/sender/text filters and meaningful unavailable-source states. Don't prefetch private content. Fetch private history through mutation state, not a long lived global query cache.
- [x] Group members page lists/searches members and uses explicit confirmation for modifications, with errors and busy/refresh states. Include entry links from IM group rows. Display circle linkage.
- [x] Root mounts `ImPage` at `/im` and `GroupMembersPage` at `/im/conversations/:conversationId/members`; registers `AdminImModule`.
- [x] Self-review source authorization, audit, deletion/expiry handling and write `task-3-report.md`. No commits or tests.

## Task 4: Platform permissions, audit, invitation operations and ads

Owner: root. Files: backend `src/admin-access/*`, `src/admin-operations/*`, Prisma schema/additive migration, existing admin controller annotations, auth invite resolution/login auditing, `src/app.module.ts`; web platform API/pages, route permissions and AppLayout/App integration.

- [x] Add console access roles SUPER_ADMIN, OPERATIONS, MODERATOR, SUPPORT with explicit permissions. Migrate current active administrators to SUPER_ADMIN; new unassigned administrators receive no implicit permissions. Guard every admin API against current DB status/role/assigned permission. Role edits require revision and reason, cannot remove own or last active super admin, and are atomically audited.
- [x] Add permission-aware navigation/routes/actions and query-cache cleanup on session changes. Existing read-only user pages remain available to roles granted USER_READ.
- [x] Add global paginated audit query by operator/action/object/date; expose redacted summaries without raw before/after/contact/message data. Add successful/failed admin login events without storing supplied email or password.
- [x] Add invite code/relationship/reward search and campaign invite generation/enable/disable/expiry/use limits. Integrate registration attribution and campaign use counting in the existing registration transaction; existing personal invite codes keep working. Avoid identifier collisions and do not bypass referral qualification.
- [x] Add validated, revision guarded ad CRUD (image URL, safe target, placement, ordering, enabled schedule). Add public/App read endpoint returning only currently published ads. Add an App display integration for a supported placement without altering unrelated app work.
- [x] Add root platform pages `/audit-logs`, `/invites`, `/ads`, `/admin-access`, wire all routes, links from user/group/VIP cards as appropriate.
- [x] Register modules; generate Prisma client, typecheck and compile both projects; inspect diff and run independent security/spec review. Update ledger and handover with exact local paths and deployment requirement.

## Review and delivery

- [x] Resolve task reviews and whole-change review findings before claiming completion.
- [x] Report build results, migration/deployment order, any unavailable chat source and fact that production has not been modified.

## Main integration adjustment

Web main 162ec01 already provides recharge review/upload and Sentry. Rebased the expansion onto it, reused SupportRechargePage at /recharge, preserved /support-recharge as a redirect, removed the duplicate new recharge implementation and its helpers, retained observability and regenerated its exact static route vocabulary. System status now uses real API/database/Redis probes only; no removed OpenIM/outbox fields.
