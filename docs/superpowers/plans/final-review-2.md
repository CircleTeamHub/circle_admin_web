# Final integrated re-review

Verdict: **Static approval. No remaining actionable P0/P1/P2 findings identified in the fixes or current-main integration reviewed here.** Both original P2 findings are resolved. This supersedes the request-changes verdict in `final-review.md` for the reviewed revisions; it does not claim runtime or device verification.

Reviewed web base `162ec01` through `7862a80`, backend base `6c461ee` through `85c5f56`, and App base `979537b` through `a4a4d5f2`, using `final-review-2-package.txt`, the fix/integration reports, and current source. The first review's broad feature review remains applicable to unchanged implementation. This pass focused on the corrective changes and the web rebase seams.

## Original findings resolved

- **Advertisement contract:** backend `src/admin-operations/admin-advertisement.service.ts`, web `src/api/platform.ts`, and App `src/services/api/advertisements.ts` now agree on the public HTTPS hostname/port policy. The backend public response filters invalid legacy rows individually before returning its bounded array. Public-IP, non-443-port and reserved-host configurations no longer pass the producer while failing the App. Invalid neighboring rows no longer invalidate valid rows in the selected set. Primary-key uniqueness and bounded selection preserve the App's envelope checks. The documented tradeoff remains: filtering occurs after selecting ten candidates, so a result may contain fewer than ten advertisements.
- **Announcement account isolation:** `src/pages/AnnouncementsPage.tsx` derives an opaque, stable storage namespace from the actor and captures namespace, digest, key and epoch in mutation variables. Administrator B's new-format pending state is independent from A's. Original actor/content retries retain the original key across navigation, reload and logout. A matching legacy global record is reused and copied into the actor namespace; a nonmatching legacy digest is preserved and does not block unrelated actors. Conflicting matching keys fail closed. Successful cleanup compares both key and digest against the captured original namespace, so a late response cannot erase another actor's pending record. Preparation and mutation-start epoch checks prevent sending a queued old attempt under a replacement session. Stale UI success/error updates are suppressed.

## Additional fixes confirmed

- **Session lifetime:** `App` owns the session listener even on `/login`, performs initial synchronization after subscribing, and unsubscribes on unmount. An epoch change clears the global query/mutation caches, destroys static AntD confirmations and remounts `AdminRoutes` by key. `setSessionIfCurrent` changes tokens without incrementing the epoch, so token refresh does not reset protected forms or caches. This addresses the lifecycle hardening observation from the first review.
- **IM permission entry:** the group-members link now requires IM_MODERATE in addition to a GROUP row, matching the existing protected route and backend guard.
- **Migration alignment:** all six new relation foreign keys explicitly specify ON UPDATE CASCADE, matching Prisma's datamodel behavior. Delete actions, seeding, checks and collision triggers remain intact. No database execution was performed in this review.
- **Earlier corrections retained:** bounded sensitive-word reading still uses CONTENT_MANAGE; message access still audits before returning private data, and expired media renewal still passes through the audited message query.

## Current-main integration reviewed

- `/recharge` renders current main's existing `SupportRechargePage` behind RECHARGE_MANAGE. `/support-recharge` is a permission-gated redirect to the canonical route. Navigation uses `/recharge`; the duplicate new page and its unused commerce API bindings are absent.
- Read the reused recharge page and API client against the backend DTO/service. Payment code create/edit/enable paths, `requiredHeaders` on presigned upload, order states, cursor pagination, real-payment confirmation copy/button, approval/rejection payloads and PROCESSING recovery fields match the backend contract. The service binds resumed approvals to the stored fulfillment payload/payment transaction, uses order identity for membership idempotency, and prevents changed fulfillment parameters from replaying an existing approval. The reused helper retains current-main HTTP-401 refresh/replay behavior; no generic retry of network/5xx financial failures was introduced by this integration.
- Current-main Sentry initialization and root error boundary remain in `src/main.tsx`. `src/api/client.ts` retains its report-and-rethrow wrapper, refresh epoch protection and original request behavior. The updated static route vocabulary retains normalized path shapes; unknown/dynamic segments and query values still go through the existing redaction path. No new request-body, private-message or token reporting was added by these changes.
- `SystemStatusPage` now reads the dashboard system section and actual API/database/Redis service fields. Unsupported queue counters and the OpenIM service field were removed. User detail retains permission-specific action gates and user/field keys for sensitive displays.
- The web integration does not change App advertisement scheduling/session code. The first review's checks of its bounded display, foreground refresh, cleanup and obsolete-response rejection remain applicable.

## Evidence and practical limits

The root reports that the integrated web typecheck and production build passed. The fixer reports backend typecheck, Nest build and Prisma validation passed. This reviewer inspected the corresponding reports and source but did not rerun commands. App evidence remains TypeScript syntax transpilation and locale JSON parsing only; full App typechecking and device behavior remain unverified.

No tests were added or run, as required. No source, dependency, Git, database or production changes were made by this re-review; only this report was written. Browser, device, live migration, concurrent transaction and failure-injection behavior were not executed. Existing limitations documented in the implementation reports, including unavailable legacy OpenIM history and point-in-time private-history snapshots, remain accurately disclosed.

The reviewed implementation is approved from this static-review perspective. Deployment and runtime validation remain separate from this verdict; production has not been changed by this review.
