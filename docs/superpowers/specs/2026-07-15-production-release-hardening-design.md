# Production Release Hardening Design

## Scope

This document defines the `circle_admin_web` half of a coordinated hardening change with `CircleTeamHub/circle_be#40`. It fixes the production review findings in `CircleTeamHub/circle_admin_web#1`: untrusted SSH host discovery, mutable rollback artifacts, Docker DNS cutover failures, mutable GitHub Action references, and missing pre-merge validation.

## Architecture

The public Caddy instance in `circle_be` becomes the only production router for same-origin `/api/*` requests. The admin Nginx container serves static SPA files only; Caddy sends admin API traffic directly to the shared blue-green backend alias and applies its dial retry policy. This removes Docker DNS state from the admin container and keeps all blue-green routing in one component.

Admin images follow build-once/promote semantics. A main-branch workflow tests and builds the exact commit once and publishes `sha-<commit>`. A release resolves an existing SHA image, promotes it to a version tag only when processing the tag push, records the resulting manifest digest, and deploys `ghcr.io/...@sha256:...`. Manual dispatch only redeploys an existing version image; it never rebuilds or rewrites the historical version tag.

## Components

### Main image workflow

- Trigger on pushes to `main`.
- Run `npm ci`, `npm test`, and `npm run build` before publishing.
- Assemble the arm64 Nginx image from the runner-built `dist` directory.
- Publish immutable commit identity as `sha-${GITHUB_SHA}` and a convenience `main` tag.
- Pin every referenced Action to a reviewed full commit SHA.

### Release workflow

- Accept only a strict version tag format.
- Resolve the tag commit and require it to be an ancestor of `main`.
- For a tag-push release, require the corresponding `sha-<commit>` image and promote that manifest to the version tag without rebuilding.
- For manual redeploy/rollback, require the version tag to already exist and do not perform any registry write.
- Resolve the selected manifest digest and expose the canonical digest reference to the deploy job.
- Require `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, and `DEPLOY_HOST`; missing trust material fails before any connection.
- Send only the digest reference to `deploy/admin-web-deploy.sh`.

### Runtime routing

- `nginx.conf` serves SPA assets and contains no backend DNS resolver or `/api/` proxy.
- Production `/api/*` routing is owned by the Caddy configuration in the paired `circle_be` change.

### Pre-merge CI and contract tests

- Add pull-request CI for install, unit tests, application build, Nginx config validation, and release-contract tests.
- Contract tests assert that Actions use full SHAs, SSH never uses `ssh-keyscan`, manual rollback cannot reach a build/push path, deployment uses a digest reference, and Nginx does not proxy `/api/`.

## Failure Handling

- Missing main image: fail the release; do not rebuild at release time.
- Missing historical version image: fail rollback with an actionable error.
- Existing version tag pointing at a different digest: fail rather than overwrite it.
- Missing or invalid SSH trust material: fail closed.
- Deployment or smoke failure: the server-side script restores the previously running admin image and returns non-zero.
- Notification failure must not hide the release result.

## Testing

Configuration changes use regression tests first. Each test must fail against the current PR head for the intended reason, then pass after the minimal implementation. Final verification includes unit tests, TypeScript/Vite build, workflow YAML parsing, shell syntax checks where applicable, Nginx configuration testing in a container, Docker Compose rendering across both repositories, and a clean Git diff review.

## Rollout Order

1. Merge and deploy the paired `circle_be#40` changes so Caddy owns admin `/api/*` routing and the server deploy script supports digest references and rollback.
2. Merge this PR.
3. Let the main image workflow publish the merge commit image.
4. Push the first version tag.
5. Verify admin index, authenticated login flow, `/api/` routing, and a manual redeploy of an older existing version.
