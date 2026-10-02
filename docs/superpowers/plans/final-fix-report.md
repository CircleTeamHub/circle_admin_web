# Final review fix report

Status: **DONE — all five requirements in `final-fix-brief.md` addressed in the assigned worktrees.** Static checks passed. Independent re-review and integration with newer web main remain the root agent's work.

## Exact edited files

Web root: `C:/Users/93256/Desktop/WIndNote/Circle_frontend/.codex-worktrees/admin-console-expansion`

- `src/app/App.tsx`
- `src/pages/AnnouncementsPage.tsx`
- `src/pages/ImPage.tsx`
- `src/api/platform.ts`
- `docs/superpowers/plans/final-fix-report.md` (this report)

Backend root: `C:/Users/93256/Desktop/WIndNote/Circle_frontend/.codex-worktrees/backend-admin-expansion`

- `src/admin-operations/admin-advertisement.service.ts`
- `prisma/migrations/20260930000000_admin_console_expansion/migration.sql`

No App files were edited: malformed-row isolation is implemented at the server public response boundary, so the existing App envelope, ten-row limit, all-row validation, unique-ID validation, and schedule checks remain in force. Builds regenerated their existing ignored output directories.

## Fixes and source evidence

1. **Advertisement producer/consumer agreement.** The web `publicHttps` validator and backend service validator now use the existing App `isPublicHttpsUrl` policy: URL length at most 2048, HTTPS, no username/password, standard 443 port, normalized lowercase hostname with a trailing dot removed for validation, dotted domain syntax, no numeric IP hostname, and no final `localhost`, `local`, `internal`, `lan`, `home`, `test`, `invalid`, or `example` component. URL parsing canonicalizes IP spellings; literal IPv6 also fails the domain syntax. Public IPs, port 8443, single-label hosts, and trailing-dot local suffix bypasses fail the same policy. Existing DTO validation remains additional validation. No DNS calls or new dependencies were introduced.

   `published()` still retrieves at most ten active rows with a narrowly selected response. It filters malformed legacy URLs, empty IDs/titles, oversized titles, non-finite dates, years that would serialize outside the App's four-digit ISO date contract, and reversed schedules before returning the public array. Valid rows in that bounded result survive an invalid neighboring row. Database primary keys provide unique IDs; App uniqueness/envelope checks are unchanged.

2. **Administrator-specific announcement recovery.** Pending keys are now `circle-admin-pending-announcement:<SHA-256 of the actor namespace>`. Storage contains only the idempotency key and digest of `[original actor, original trimmed content]`; it contains neither content nor raw actor ID. Navigation, refresh, and logout do not remove pending identities. A later login by the original actor derives the same namespace. Another actor has an independent record and cannot be blocked by the first actor's new-format pending identity.

   The old global record is read without overwriting or deleting it. A matching original actor/content digest reuses its original idempotency key and persists that identity in the actor namespace; a nonmatching legacy record remains available for its original retry. Conflicting matching keys fail closed for operator reconciliation. Successful cleanup compares both key and digest and uses the namespace captured in the original mutation variables, never the current session's namespace. A stale response can clean only its matching original identity, while epoch guards prevent stale UI changes. Epoch is checked after hashing and again when the mutation starts, so a queued mutation cannot broadcast an old actor's content under a newer session. Error notifications from superseded preparation/mutations are suppressed.

3. **Application-lifetime session cleanup.** `App` owns the sole session subscription, including while `/login` is mounted. An epoch change clears the global QueryClient (query and mutation caches), calls `Modal.destroyAll()`, and changes the protected `AdminRoutes` key to remount its local state and all protected descendants. Session props replace the former route-local subscription. Token refresh updates session tokens with the same epoch, preserving forms, caches, and the route key. Listener cleanup is returned from the effect; initial synchronization closes a render-to-effect event gap.

4. **IM entry gate.** The group-member link requires both a GROUP row and `hasPermission("IM_MODERATE")`, matching its existing protected route and backend permission.

5. **Migration alignment.** All six new foreign keys now declare `ON UPDATE CASCADE`: AdminAccess user, CampaignInvite identifier/owner, CampaignInviteUse campaign/user, and AdminOperationRequest actor. Delete actions, checks, triggers, indexes, and initial admin seeding are untouched. No schema changes or database connections were required.

## Executed static checks

Commands ran in the respective worktree roots. All completed with exit code **0**.

| Worktree | Command | Result |
| --- | --- | --- |
| Web | `& '../backend-admin-expansion/node_modules/.bin/prettier.cmd' --write src/app/App.tsx src/pages/AnnouncementsPage.tsx src/pages/ImPage.tsx src/api/platform.ts` | Formatted assigned source using installed backend Prettier. |
| Backend | `& './node_modules/.bin/prettier.cmd' --write src/admin-operations/admin-advertisement.service.ts` | Formatted assigned backend source. |
| Web | `npm run typecheck` | `tsc --noEmit`; no diagnostics. |
| Web | `npm run build -- --configLoader runner` | TypeScript and Vite passed; 4908 modules transformed; final bundle `index-CvtKO0UL.js`, 1348.65 kB / gzip 432.51 kB; built in 6.17s. |
| Backend | `& './node_modules/.bin/tsc.cmd' --noEmit -p tsconfig.build.json` | No diagnostics. |
| Backend | `npm run build` | Nest build passed; postbuild copied generated Prisma client into existing `dist/src/generated`. |
| Backend | `& './node_modules/.bin/prisma.cmd' validate` | `The schema at prisma/schema.prisma is valid`. |

The affected format/type/build checks were rerun after adding the queued-mutation epoch guard and legacy extended-year isolation. Prisma validation preceded those source-only changes; its schema and config were unchanged afterward. No tests were added or run.

## Remaining limitations

- Static checks establish compilation and schema syntax, not browser/device behavior, broadcast delivery, real database migration execution, or concurrency behavior. No live database, browser, device, or external service was used.
- The App remains unchanged and has no new full typecheck/device verification; its previously reported dependency limitation persists.
- Invalid legacy rows are removed from the already bounded first ten public candidates. The response may contain fewer than ten ads; no extra unbounded query or refill scan was added. Administrators can repair invalid records through the admin listing/update flow.
- The preserved legacy global record lacks a stored actor namespace. Only the original actor/content digest identifies it; unrelated submissions leave it intact. Malformed stored records and conflicting retry identities require reconciliation rather than silent deletion.
- The hostname policy matches the App's lexical policy and does not promise DNS resolution or reject domains based on their resolved IP addresses.
- Vite still warns that the bundle exceeds 500 kB after minification; no unrelated code-splitting work was included.
- No original dirty repositories, dependencies, Git state, production data, commits, pushes, deployment, or main-branch integration were changed. Root must recheck the integrated newer web main.
