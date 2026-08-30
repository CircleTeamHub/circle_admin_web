import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin nginx serves only the SPA and leaves API routing to Caddy', () => {
  const nginx = read('nginx.conf');

  assert.doesNotMatch(nginx, /location\s+\/api\//);
  assert.doesNotMatch(nginx, /resolver\s+127\.0\.0\.11/);
  assert.match(nginx, /try_files\s+\$uri\s+\/index\.html/);
});

test('release SSH setup fails closed without pretrusted host keys', () => {
  const release = read('.github/workflows/release.yml');
  const validation = release.slice(
    release.indexOf('- name: Configure SSH'),
    release.indexOf('mkdir -p ~/.ssh'),
  );

  assert.match(validation, /\[ -z "\$DEPLOY_KNOWN_HOSTS" \]/);
  assert.doesNotMatch(release, /ssh-keyscan/);
});

test('release promotes prebuilt images and deploys immutable digests', () => {
  const release = read('.github/workflows/release.yml');
  assert.ok(
    existsSync(new URL('../.github/workflows/build-image.yml', import.meta.url)),
    'main must build the commit image before release',
  );
  const buildImage = read('.github/workflows/build-image.yml');

  assert.match(buildImage, /sha-\$\{\{ github\.sha \}\}/);
  assert.match(buildImage, /node --test scripts\/release-contract\.mjs/);
  assert.doesNotMatch(release, /docker\/build-push-action/);
  assert.match(release, /needs_promotion/);
  assert.match(release, /if: \$\{\{ needs\.resolve\.outputs\.needs_promotion == 'true' \}\}/);
  assert.match(release, /image_ref=\$repo@\$digest/);
  assert.match(release, /ADMIN_WEB_IMAGE: \$\{\{ needs\.resolve\.outputs\.image_ref \}\}/);
});

test('every admin workflow action is pinned to a full commit SHA', () => {
  const workflowDir = new URL('../.github/workflows/', import.meta.url);
  for (const filename of readdirSync(workflowDir)) {
    const workflow = read(`.github/workflows/${filename}`);
    for (const line of workflow.split(/\r?\n/).filter((item) => /\buses:/.test(item))) {
      assert.match(line, /uses:\s+[^\s@]+@[0-9a-f]{40}(?:\s+#.*)?$/i, `${filename}: ${line.trim()}`);
    }
  }
});

test('admin pull requests run application and release contract checks', () => {
  const ci = read('.github/workflows/ci.yml');

  assert.match(ci, /^\s*pull_request:/m);
  assert.match(ci, /run: npm ci/);
  assert.match(ci, /run: npm test/);
  assert.match(ci, /run: npm run build/);
  assert.match(ci, /run: node --test scripts\/release-contract\.mjs/);
  assert.match(ci, /nginx -t/);
});

test('admin release image pins its nginx base by digest', () => {
  const dockerignore = read('Dockerfile.release.dockerignore');

  for (const filename of ['Dockerfile', 'Dockerfile.release']) {
    assert.match(
      read(filename),
      /^FROM nginx:[^@\s]+@sha256:[0-9a-f]{64} AS runtime$/m,
      `${filename} must pin its runtime nginx base by digest`,
    );
  }
  assert.doesNotMatch(dockerignore, /^dist\/?$/m);
});

test('admin runtime images install current Alpine security updates', () => {
  const workflow = read('.github/workflows/build-image.yml');

  for (const filename of ['Dockerfile', 'Dockerfile.release']) {
    const dockerfile = read(filename);

    assert.match(
      dockerfile,
      /^RUN apk upgrade --no-cache$/m,
      `${filename} must upgrade fixable Alpine packages during image build`,
    );
  }

  assert.match(
    workflow,
    /^\s+no-cache-filters: runtime$/m,
    'the release build must re-run the runtime security-update layer',
  );
  assert.match(
    workflow,
    /^\s+- name: Check for existing commit image$/m,
    'rerunning a commit must detect its already-published immutable image',
  );
  assert.match(
    workflow,
    /^\s+if: steps\.existing\.outputs\.exists != 'true'$/m,
    'an existing commit image must not be overwritten by mutable packages',
  );
  assert.match(
    workflow,
    /^\s+tags: \$\{\{ steps\.meta\.outputs\.repo \}\}:sha-\$\{\{ github\.sha \}\}$/m,
    'the build step must publish only the immutable commit image',
  );
  assert.match(
    workflow,
    /^\s+- name: Promote current main image$/m,
    'reruns must repair a missing or stale main tag from the commit image',
  );
  assert.match(
    workflow,
    /git ls-remote origin refs\/heads\/main/,
    'main promotion must verify the commit is still the current branch head',
  );
  assert.match(
    workflow,
    /docker buildx imagetools create --tag "\$MAIN_IMAGE" "\$SHA_IMAGE"/,
    'main promotion must reuse the immutable commit manifest',
  );
  assert.match(
    workflow,
    /elif grep -Eiq 'manifest unknown\|not found'/,
    'only an explicit missing-image response may trigger a rebuild',
  );
  assert.match(
    read('README.md'),
    /docker build --no-cache-filter runtime -t circle-admin-web:local \./,
    'manual builds must refresh the runtime security-update layer',
  );
});

test('admin workflow and server use the same strict version format', () => {
  const strictVersion = String.raw`^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$`;

  assert.ok(read('.github/workflows/release.yml').includes(strictVersion));
});
