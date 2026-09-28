// P0: Reorder inline mode (swap bar + apply)
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok, downloadCurrent } from './helpers.mjs';

const FIX = await generateFixtures();

/** Enter reorder mode with the grid (4-per-row) so page badges are rendered. */
async function setup(page) {
  await launchApp(page, FIX.fixA);
  await page.locator('button[aria-label="4 pages per row"]').click();
  await page.waitForTimeout(600);
  await openTool(page, 'Reorder');
  await page.waitForTimeout(300);
}

async function badges(page) {
  return page.locator('span.text-\\[9px\\]').allInnerTexts();
}

async function swap(page, a, b) {
  const inputs = page.locator('div.fixed.z-40 input[type=number]');
  await inputs.nth(0).fill(String(a));
  await inputs.nth(1).fill(String(b));
  await page.locator('div.fixed.z-40').getByRole('button', { name: 'Swap', exact: true }).click();
  await page.waitForTimeout(400);
}

async function savedBytes(page) {
  const dl = await downloadCurrent(page);
  const { readFile } = await import('node:fs/promises');
  return readFile(await dl.path());
}

async function firstPageText(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  const tc = await (await doc.getPage(1)).getTextContent();
  return tc.items.map((i) => i.str).join(' ');
}

test('O1: swap 1↔3 then Apply reorders document', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    await swap(page, 1, 3);
    const b = await badges(page);
    ok(t, 'grid shows 3,2,1', b.join(',') === '3,2,1', b.join(','));
    await page.getByRole('button', { name: 'Apply' }).last().click();
    await page.locator('div.fixed.z-40').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const bytes = await savedBytes(page);
    const first = await firstPageText(bytes);
    ok(t, 'first page is original page 3', first.includes('FIXA page 3 of 3'), first.slice(0, 40));
    await shot(page, 'reorder-o1');
  } finally { await browser.close(); }
});

test('O2: Cancel restores original order', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    await swap(page, 1, 3);
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await page.waitForTimeout(500);
    const b = await badges(page);
    ok(t, 'order restored 1,2,3', b.join(',') === '1,2,3', b.join(','));
    await shot(page, 'reorder-o2');
  } finally { await browser.close(); }
});

test('O3: identical swap values keep button disabled', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const inputs = page.locator('div.fixed.z-40 input[type=number]');
    await inputs.nth(0).fill('2');
    await inputs.nth(1).fill('2');
    const btn = page.locator('div.fixed.z-40').getByRole('button', { name: 'Swap', exact: true });
    ok(t, 'swap disabled for equal pages', await btn.isDisabled());
    await shot(page, 'reorder-o3');
  } finally { await browser.close(); }
});
