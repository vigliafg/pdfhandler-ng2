// P0: Extract Pages modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, saveDownload, dialog, validatePdf, selectPages, shot, ok } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Extract'); }

async function setCustomRange(page, shell, value) {
  await shell.getByText('Custom range').click();
  await shell.locator('input[placeholder*="10-20"]').fill(value);
}

async function setOutput(page, shell, kind) {
  await shell.getByRole('button', { name: kind }).click();
}

test('E1: extract range 2-3 as single PDF', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract Pages');
    await setCustomRange(page, shell, '2-3');
    const dl = await saveDownload(page, () => shell.getByRole('button', { name: /Extract 2 pages/ }).click());
    assert.match(dl.filename, /-extracted\.pdf$/);
    const info = await validatePdf(dl.path, { text: 'FIXA page 2 of 3' });
    ok(t, '2 pages extracted', info.numPages === 2, `got ${info.numPages}`);
    ok(t, 'content is page 2', info.hasText);
    await shot(page, 'extract-e1');
  } finally { await browser.close(); }
});

test('E2: extract all as separate ZIP', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract Pages');
    await setOutput(page, shell, 'Separate files (ZIP)');
    const dl = await saveDownload(page, () => shell.getByRole('button', { name: /Extract 3 pages/ }).click());
    assert.match(dl.filename, /-extracted\.zip$/);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await readFile(dl.path));
    const names = Object.keys(zip.files);
    ok(t, 'zip has 3 pdfs', names.length === 3, names.join(','));
    const inner = await zip.file(names[0]).async('uint8array');
    const doc = await (await import('pdf-lib')).PDFDocument.load(inner);
    ok(t, 'each entry is 1 page', doc.getPageCount() === 1);
    await shot(page, 'extract-e2');
  } finally { await browser.close(); }
});

test('E3: extract with deleteAfter compacts document', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract Pages');
    await setCustomRange(page, shell, '1');
    await shell.getByText('Delete pages after extraction').click();
    await saveDownload(page, () => shell.getByRole('button', { name: /Extract 1 page/ }).click());
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    ok(t, 'viewer reloaded with 2 pages', body.includes('1/2'), body.slice(0, 100));
    await shot(page, 'extract-e3');
  } finally { await browser.close(); }
});

test('E4: custom range out of bounds yields no pages and disabled button', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract Pages');
    await setCustomRange(page, shell, '99-100');
    const btn = shell.getByRole('button', { name: /Extract 0 pages/ });
    ok(t, 'execute disabled for invalid range', await btn.isDisabled());
    await shot(page, 'extract-e4');
  } finally { await browser.close(); }
});
