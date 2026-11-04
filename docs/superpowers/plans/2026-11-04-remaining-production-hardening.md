# Remaining Production Hardening

**Goal:** Close the three remaining items explicitly authorized by the user: logout/rotation consistency, the historical CI teardown exception, and real manifest-promotion verification.

**Constraints:** Preserve prior fixes and unrelated checkouts; no new dependencies or speculative abstractions; use existing auth locks/revocation primitives; do not deploy or write a production registry. Root owns commits. Use worktree-local temporary directories and stop every temporary process/container after verification.

## Task 1: Logout revokes the rotating session family

Backend worktree: `backend-admin-logout-fix`, base `483a782`.

- [x] Trace logout, refresh rotation, family locks, access-session revocation and existing tests.
- [x] Add regression tests before production edits: rotation before logout cannot leave its descendant refresh/access session usable; logout before rotation makes rotation fail; another family/account remains usable; repeated logout remains safe.
- [x] Reuse the existing account lock and family/scope revocation primitives to make logout linearize with rotation. Preserve the existing endpoint/response and admin audit behavior. Avoid expanding logout to unrelated families.
- [x] Run the focused auth/revocation tests and backend type/build checks. Document any integration limits.

## Task 2: Resolve the historical CI teardown exception

Frontend worktree: `admin-production-fixes`, base `5d3d4ff`.

- [x] Inspect the exact failing CI log and `AdminNicknameEditor` test lifecycle.
- [x] Establish a deterministic failing regression for async work surviving teardown, or reproduce the original exception with the same relevant lifecycle; do not merely retry until green.
- [x] Fix the owned async cleanup/awaiting issue at its narrowest seam. Do not suppress unhandled errors, increase timeouts, or change production behavior merely to satisfy tests.
- [x] Verify the focused suite and full frontend tests/build without unhandled errors.

## Task 3: Exercise actual registry promotion

- [x] Determine available Docker runtime and registry tooling. Prefer a disposable local registry; do not publish to the production GHCR repository or deploy.
- [x] Push a real single-platform source manifest and resolve its digest.
- [x] Execute the same `docker buildx imagetools create --prefer-index=false` promotion used by main/version workflows.
- [x] Compare source and promoted manifest digests, and demonstrate that the uncorrected default promotion changes the digest when feasible.
- [x] Save concise commands/results and remove the test registry, containers, images and helper processes started by this task. Restore Docker Desktop to its original stopped state if started solely for this check.

## Integration and handover

- [x] Independent review of backend auth changes and frontend teardown fix; resolve substantive findings.
- [x] Verify relevant tests/builds and clean diffs, update the prior known-boundary record with the backend fix and deployment dependency.
- [x] Preserve local fix branches and report exact validated revisions and any genuine environment blocker.


## Delivered revisions

- Backend branch `codex/admin-logout-family-fix`: `3f39ef9`, based on current main `483a782`.
- Frontend branch `codex/admin-production-fixes`: CI cleanup code `b2009e0`, preserving the prior six production fixes.
- No endpoint, schema, dependency, lockfile, or production deployment changes were needed.

## Verification evidence

Both projects were copied read-only into disposable Linux / Node 22.23.4 containers and installed with their exact committed lockfile using `npm ci`. This removes the backend implementer's initial local-copy dependency-version caveat.

| Check | Result |
| --- | --- |
| Frontend full suite | 64 files, 325 tests passed; no unhandled errors |
| Frontend build | TypeScript and Vite production build passed |
| Release contracts | 11 passed |
| Backend complete auth unit area | 28 suites, 484 tests passed |
| Real PostgreSQL refresh fixture | 22 tests passed, including APP/ADMIN and both logout/rotation lock orderings |
| Backend build | Nest build and generated-client copy passed |
| Changed backend files lint | 0 errors; one pre-existing test-fixture IP warning |
| Independent code review | No actionable P1/P2 findings |
| Release image runtime | Native and production linux/arm64 builds passed; both nginx configuration checks passed |

The CI test leak has deterministic red/green evidence: an AntD static success-message portal survives ordinary Testing Library cleanup before the fix; awaited `act(message.destroy)` removes it and drains its owned work. The exact old Linux scheduling exception was not artificially recreated; the same Node major/Linux runtime now passes the complete suite without suppressing unhandled errors.

## Actual registry promotion

A disposable Distribution 3 registry listened only on IPv4 loopback. The actual production-platform `Dockerfile.release` image was built with `--platform linux/arm64 --provenance=false`, exported as OCI, and uploaded through the standard Registry V2 blob/manifest API. This avoids Docker Desktop's VM-to-Windows loopback push limitation without changing daemon configuration.

Source image manifest: `sha256:bc9ae6c7c57b3f853f38348ac3f445d6073f85bb7b4ecd4b5e641e58c5fab5da`.

- Actual main-tag promotion with `--prefer-index=false`: exactly the source digest.
- Actual version-tag promotion with `--prefer-index=false`: exactly the source digest.
- Negative control using the old default command: OCI index `sha256:ba3aa4f7074f2bfafb25efa11211580446c3f009a78345df02c12362789423dd`, different from the source.

This is real registry I/O with the buildx CLI, not a mocked digest comparison. A smaller arm64 fixture independently showed the same result. References: [Docker imagetools behavior](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/), [Registry V2 upload protocol](https://distribution.github.io/distribution/spec/api/).

## Cleanup and rollout

Temporary registry/PostgreSQL/CI containers and all task-created image tags were removed. Docker Desktop and its backend exited, and the engine pipe is absent, restoring the original stopped state. All test/build command sessions completed; no Node processes with either task worktree path remain. Shared app services and unrelated user processes were preserved.

Backend family revocation must be deployed for the new logout behavior to apply online. This task only creates local commits and validation artifacts; it does not push, merge, or deploy.
