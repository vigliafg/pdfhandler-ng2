// P1: Reverse Page Order modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, dialog, validatePdf, shot, ok, downloadCurrent } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Reverse'); }

async function setCustomRange(page, shell, value) {
  await shell.getByText('Custom range').click();
  await shell.locator('input[placeholder*="10-20"]').fill(value);
}

async function reverseAndSave(page, shell, btnName) {
  await shell.getByRole('button', { name: btnName }).click();
  await page.locator('div.fixed').getByText('Reverse Page Order', { exact: true })
    .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  const dl = await downloadCurrent(page);
  return dl.path();
}

test('V1: reverse all pages', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Reverse Page Order');
    // mapping preview must show 1 → 3
    const preview = await shell.locator('text=/1 → 3/').count();
    ok(t, 'mapping preview shown', preview > 0);
    const path = await reverseAndSave(page, shell, /Reverse 3 pages/);
    // page order reversed: first page now holds original page 3
    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(path);
    ok(t, 'first page is original page 3', await firstPageIs(bytes, 'FIXA page 3 of 3'));
    await shot(page, 'reverse-v1');
  } finally { await browser.close(); }
});

test('V2: reverse subrange 1-2 keeps page 3 in place', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Reverse Page Order');
    await setCustomRange(page, shell, '1-2');
    const path = await reverseAndSave(page, shell, /Reverse 2 pages/);
    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile(path);
    ok(t, 'page 1 is original page 2', await firstPageIs(bytes, 'FIXA page 2 of 3'));
    ok(t, 'page 3 still last', await lastPageIs(bytes, 'FIXA page 3 of 3'));
    await shot(page, 'reverse-v2');
  } finally { await browser.close(); }
});

async function firstPageIs(bytes, needle) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  const tc = await (await doc.getPage(1)).getTextContent();
  return tc.items.map((i) => i.str).join(' ').includes(needle);
}
async function lastPageIs(bytes, needle) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  const tc = await (await doc.getPage(doc.numPages)).getTextContent();
  return tc.items.map((i) => i.str).join(' ').includes(needle);
}
