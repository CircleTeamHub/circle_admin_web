# Production Review Fixes Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement and review each task before proceeding.

**Goal:** Fix the six confirmed production-review findings on main 6374dadd.

**Architecture:** Preserve the current React, Ant Design, TanStack Query and API contracts. Fix session handling at its shared boundary, isolate route-owned drafts, refresh campaign form values with their revision, preserve promoted manifest identity, and display task lifecycle states accurately.

**Tech Stack:** React 19, TypeScript, TanStack Query, Ant Design 6, Vitest, Node test runner, GitHub Actions.

## Global Constraints

- Work only in this isolated checkout on codex/admin-production-fixes.
- Preserve all unrelated user changes. No new dependencies, broad refactors, backend edits, deployments or merges.
- Write focused regression tests first and observe the intended failures; implement the smallest fix and run the focused tests again.
- No automatic network/5xx retry of mutations. Never expose tokens or private data in messages, logs or reports.
- Existing getSessionEpoch guards and query-cache clearing remain authoritative for account changes.
- Run commands with TEMP and TMP beneath .superpowers/sdd/tmp to avoid this Windows sandbox's temporary-file rename restriction.
- Root owns commits, full-suite validation and final integration. Implementers write only their assigned source/test files and report.
- Stop all temporary processes after use; do not start development servers.

## Task 1: Session revocation and transient request failures

**Files:** src/api/auth.ts, src/api/auth.test.ts, src/api/client.ts, src/api/client.test.ts, src/components/AppLayout.tsx, src/components/AppLayout.test.tsx, src/observability/route-segments.ts.

**Interfaces:** Keep apiClient and session APIs compatible. Add logout(refreshToken: string): Promise<void> using POST /auth/logout with auth:false and retryOnUnauthorized:false.

- [x] Add API test asserting the logout URL, POST body containing only refreshToken, and no bearer/refresh replay.
- [x] Add layout behavior tests: clicking logout calls revocation before clearing the session/navigating; pending disables repeated submissions; success clears the same session; a revocation failure is visible and permits retry instead of silently claiming success. A stale completion must not clear a replacement session.
- [x] Add client regression tests: initial 401 followed by refresh 503 preserves the original session; successful rotation followed by replay network failure preserves the rotated tokens; definitive refresh 401/403 still clears the matching session. Retain existing concurrent-refresh and session-epoch tests.
- [x] Run the focused tests and record the expected red failures.
- [x] Implement revocation in the existing auth API and layout mutation pattern. A failed revocation retains the current session so the operator can retry, with a generic Chinese error. A replacement session must remain untouched by a late completion.
- [x] Narrow the client catch that clears credentials to definitive refresh authentication failures. The replay fetch must not share that session-clearing catch. Do not add retries, timeouts or new abstractions.
- [x] Add the new logout literal to the static route vocabulary. Run auth, client, AppLayout, session, App, RequireAdmin and route-segments test files; report red/green counts and exact changed files.

## Task 2: Group-member drafts and campaign conflict recovery

**Files:** src/pages/GroupMembersPage.tsx, src/pages/GroupMembersPage.test.tsx (new), src/pages/InvitesPage.tsx, src/pages/InvitesPage.test.tsx (new).

**Interfaces:** Preserve listImMembers/moderateImMember and platformList/platformWrite contracts.

- [x] Add group regression: history contains A/members and B/members, with the same member in both groups; open B's management dialog, enter a reason, navigate Back to A. B's draft must disappear and must not submit any mutation to A. Also cover a normal B operation.
- [x] Add campaign regression: open enabled campaign version 1, maxUses 100 and expiry 2027-01-01T00:00:00Z. First PATCH returns 409; refresh returns disabled version 2, maxUses 5, expiry 2028-01-01T00:00:00Z. Verify the displayed fields and subsequent PATCH use the refreshed settings and version together, comparing parsed timestamps rather than ISO string precision.
- [x] Run the two new files and record expected red failures.
- [x] Isolate all group-owned transient state by conversationId, using the smallest lifecycle boundary consistent with existing keyed management components. Preserve route permission handling.
- [x] On successful conflict refresh, populate enabled, maxUses and local expiresAt from the same refreshed campaign row before clearing the conflict. Do not blindly apply old edited values to a new revision.
- [x] Run the new tests plus GroupDetailPage, CommunityPage and VipRechargePage tests; report red/green evidence and exact changed files.

## Task 3: Immutable image promotion and truthful task states

**Files:** .github/workflows/release.yml, .github/workflows/build-image.yml, scripts/release-contract.mjs, src/pages/task-presentation.ts, src/pages/task-presentation.test.ts, src/pages/TasksPage.tsx, src/pages/TasksPage.test.tsx, src/pages/PushOperationsPage.tsx, src/pages/PushOperationsPage.test.tsx.

**Interfaces:** Preserve existing task helper signatures and notification result summaries. No API/schema changes.

- [x] Update regression expectations so COMPLETED, SUCCEEDED, TERMINAL and exhausted FAILED tasks (retryable !== true) have no automatic next-attempt timestamp; PENDING, PROCESSING and retryable FAILED notification tasks retain their schedule. Use the existing optional Task.retryable field; the backend marks it true for notification FAILED rows and false for other queues.
- [x] Verify a failed exhausted task does not promise automatic retry, and SUCCEEDED is displayed as successful completion. Preserve notification delivery-count summaries and manual push retry controls.
- [x] The push-details endpoint omits retryable while tasks() supplies it. Cover a real FAILED push response with a future nextAttemptAt, no retryable, and empty deliveryCounts. Normalize missing notification retry semantics once at the Push Operations retrieval boundary, retaining explicit eligibility flags and preserving its schedule/waiting copy; do not make unknown FAILED tasks globally retryable.
- [x] Add release-contract coverage requiring source manifest identity to be preserved in both version and main promotion commands; observe failure before workflow edits.
- [x] Run task-presentation tests and node --test scripts/release-contract.mjs; record expected red failures.
- [x] Add --prefer-index=false to the two existing single-source promotion commands, retaining digest verification. Update existing main-promotion contract expectations to allow the required flag.
- [x] Hide automatic schedules for the terminal statuses above, use stopped FAILED copy for exhausted jobs while retaining automatic-retry copy for retryable notification FAILED rows, and recognize SUCCEEDED in completion text and task status color. Avoid queue-specific new abstractions.
- [x] Run task-presentation, TasksPage and PushOperationsPage tests and release contracts; report red/green evidence and exact changed files.

## Final verification

- [x] Independent spec/quality review after each task; resolve substantive findings.
- [x] Run npm test -- --maxWorkers=4, npm run build and node --test scripts/release-contract.mjs once on the integrated code.
- [x] Review the whole branch against all six findings and inspect git diff --check.
- [x] Preserve the fix branch/worktree for the user. Do not push, merge or deploy without an explicit request.
- [x] Remove temporary logs/test caches and verify all started child processes exited.


## Logout boundary resolved by backend follow-up

The user authorized this follow-up. Backend commit `3f39ef9` now revokes the token family under the same account lock as rotation and advances durable FAMILY generation. Real PostgreSQL tests verify both orderings and refresh/access invalidation. Deploying that backend commit is required for the behavior to take effect online; no production deployment was performed. See `2026-11-04-remaining-production-hardening.md` for current verification.


## Final verification results

Validated source revision: `2a1ba49` on Windows / Node 24. The final documentation-only commit does not change this source.

| Check | Result |
| --- | --- |
| `npm test -- --maxWorkers=4` | 64 files, 325 tests passed; exit 0 |
| `npm run build` | TypeScript checking and Vite production build passed; exit 0 |
| `node --test scripts/release-contract.mjs` | 11 checks passed; exit 0 |
| `git diff --check` | Passed |
| Independent task and whole-branch review | Approved after correcting the push-details response adaptation |

Existing AntD/jsdom warnings and the large-bundle warning remain. At this initial checkpoint, real registry promotion was not executed. The authorized follow-up records successful local registry promotion and real PostgreSQL verification; production deployment remains separate. All started test/build command sessions exited; temporary test caches/logs were removed, and no temporary Node/esbuild/copy/shell processes remained visible. The branch and worktree are preserved for review; no push, merge or deployment was performed.
