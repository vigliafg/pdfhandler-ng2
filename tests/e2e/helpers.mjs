// Shared Playwright helpers for the e2e suite.
import { chromium } from '/home/vigliafg/.nvm/versions/node/v24.18.0/lib/node_modules/playwright/index.mjs';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert';

export const BASE = 'http://localhost:5199/';
export const SHOTS = '/tmp/e2e-shots';
export const OUT = '/tmp/e2e-out';
const PW_ROOT = '/home/vigliafg/.nvm/versions/node/v24.18.0/lib/node_modules/playwright';

export async function launch({ acceptDownloads = true } = {}) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: process.env.HEADLESS !== '0',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  return { browser, page };
}

/** Open the app, bypass service worker, and load a fixture PDF into the viewer. */
export async function launchApp(page, fixturePath) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // disable SW + caches so we always test fresh assets
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    for (const r of regs) await r.unregister();
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  });
  await page.locator('#root input[type=file]').first().setInputFiles(fixturePath);
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(800);
}

/** Open a tool by its drawer/menu label. Expands the section if collapsed. */
export async function openTool(page, label) {
  const menuBtn = page.getByRole('button', { name: 'Toggle menu' });
  await menuBtn.click();
  await page.waitForSelector('nav', { timeout: 5000 });
  const nav = page.locator('nav');
  let item = nav.getByText(label, { exact: true }).first();
  if (!(await item.count())) {
    // expand all collapsed drawer sections then retry
    for (const section of await nav.locator('button.uppercase').all()) await section.click();
    await page.waitForTimeout(200);
    item = nav.getByText(label, { exact: true }).first();
  }
  await item.click();
  await page.waitForTimeout(400);
}

/** Run fn() capturing the next download; returns { path, filename }. */
export async function saveDownload(page, fn) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), fn()]);
  const path = await download.path();
  return { path, filename: download.suggestedFilename() };
}

/** Modal dialog shell locator (the white zinc-900 rounded box). */
export function dialog(page, title) {
  return page.locator(`text=${title}`).locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
}

/** Validate a PDF file: page count, rotations, searchable text. */
export async function validatePdf(path, { text } = {}) {
  const bytes = await readFile(path);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const info = { numPages: doc.getPageCount() };
  try {
    info.rotations = doc.getPages().map((p) => p.getRotation().angle % 360);
  } catch { info.rotations = null; }
  if (text !== undefined) info.hasText = await pdfHasText(bytes, text);
  return info;
}

/** Search text inside PDF bytes using pdfjs legacy build (no worker in Node). */
export async function pdfHasText(pdfBytes, needle) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  let found = false;
  for (let i = 1; i <= doc.numPages && !found; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    const t = tc.items.map((it) => it.str).join(' ');
    if (t.includes(needle)) found = true;
  }
  return found;
}

/** Enable select mode and click pages in the grid (uses page badges for locating). */
export async function selectPages(page, nums) {
  // Enter select mode via editor toolbar "Select" button if not already active
  const selBtn = page.locator('button[title="Select"]');
  if (await selBtn.count()) { await selBtn.click(); await page.waitForTimeout(200); }
  for (const n of nums) {
    const badge = page.locator(`span.text-\\[9px\\].tabular-nums`, { hasText: new RegExp(`^${n}$`) }).first();
    await badge.scrollIntoViewIfNeeded().catch(() => {});
    // click the thumbnail container (badge's ancestor cell)
    await badge.locator('xpath=ancestor::div[2]').click();
    await page.waitForTimeout(150);
  }
}

/** Save the current document via header Save → confirm Download. Returns the download. */
export async function downloadCurrent(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    (async () => {
      await page.locator('header').getByRole('button', { name: 'Save' }).click();
      await page.getByRole('button', { name: 'Download' }).click();
    })(),
  ]);
  return download;
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export function ok(_t, name, pass, detail = '') {
  assert.ok(pass, `${name}${detail ? ' — ' + detail : ''}`);
}
