// e2e runner: prepares environment, runs all specs, prints summary.
// Usage: npm run test:e2e            (all specs)
//        node tests/e2e/run.mjs merge compose   (subset)
import { spawn, execSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = 'http://localhost:5199/';
const ALL_SPECS = [
  'extract', 'delete', 'rotate', 'reverse', 'copymove', 'split', 'merge', 'compose',
  'insertreplace', 'reorder',
  'info', 'metadata', 'watermark-text', 'watermark-image', 'pagenumbers', 'addpages',
  'exportpng', 'extracttext', 'crypto',
];

async function ensureServer() {
  try {
    const res = await fetch(BASE);
    if (res.ok) { console.log('▸ dev server already running on :5199'); return; }
  } catch { /* not running */ }
  console.log('▸ starting vite dev server on :5199 …');
  const child = spawn('npx', ['vite', '--port', '5199', '--strictPort'], {
    cwd: new URL('../..', import.meta.url).pathname,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { if ((await fetch(BASE)).ok) { console.log('▸ server ready'); return; } } catch {}
  }
  throw new Error('vite dev server failed to start');
}

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const specs = requested.length ? requested : ALL_SPECS;

await ensureServer();
await rm('/tmp/e2e-out', { recursive: true, force: true });
await mkdir('/tmp/e2e-out', { recursive: true });
await mkdir('/tmp/e2e-shots', { recursive: true });

let pass = 0, fail = 0;
const failed = [];
for (const spec of specs) {
  const file = new URL(`./${spec}.spec.mjs`, import.meta.url).pathname;
  if (!existsSync(file)) { console.log(`SKIP ${spec} (no spec file)`); continue; }
  console.log(`\n━━━ ${spec} ━━━`);
  const proc = spawn(process.execPath, ['--test', file], { stdio: 'inherit' });
  const code = await new Promise((r) => proc.on('exit', r));
  if (code === 0) pass++; else { fail++; failed.push(spec); }
}

console.log(`\n══════════════════════════════`);
console.log(`${pass} spec(s) passed, ${fail} failed${failed.length ? ': ' + failed.join(', ') : ''}`);
process.exit(fail ? 1 : 0);
