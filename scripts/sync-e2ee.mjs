import { cp, mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = new URL('../../circle-im/packages/e2ee/', import.meta.url);
const target = new URL('../vendor/e2ee/', import.meta.url);
await mkdir(target, { recursive: true });
const hashes = {};
for (const file of (await readdir(source)).filter(name => /\.(mjs|mts|ts)$/.test(name) || name === 'package.json').sort()) {
  await cp(new URL(file, source), new URL(file, target));
  hashes[file] = createHash('sha256').update(await readFile(new URL(file, source))).digest('hex');
}
await writeFile(new URL('SOURCE.json', target), JSON.stringify({ source: 'circle-im/packages/e2ee', hashes }, null, 2) + '\n');
