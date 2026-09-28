// P1: Split Document modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, saveDownload, dialog, shot, ok } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

async function setup(page, file = FIX.fixA) { await launchApp(page, file); await openTool(page, 'Split'); }

async function chooseMode(page, shell, label) {
  await shell.getByText(label, { exact: true }).click();
  await page.waitForTimeout(200);
}

async function zipEntries(dl) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await readFile(dl.path));
  return Object.keys(zip.files).sort();
}

test('S1: one page per file → zip with 3 entries', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Split Document');
    await chooseMode(page, shell, 'One page per file');
    const dl = await saveDownload(page, () => shell.getByRole('button', { name: /Split into 3 files/ }).click());
    const names = await zipEntries(dl);
    ok(t, '3 files in zip', names.length === 3, names.join(','));
    await shot(page, 'split-s1');
  } finally { await browser.close(); }
});

test('S2: every 2 pages → zip with 2 entries (2+1)', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Split Document');
    await chooseMode(page, shell, 'Every N pages');
    await shell.locator('input[type=number]').first().fill('2');
    const dl = await saveDownload(page, () => shell.getByRole('button', { name: /Split into 2 files/ }).click());
    const names = await zipEntries(dl);
    ok(t, '2 files in zip', names.length === 2, names.join(','));
    ok(t, 'names carry page ranges', names[0].includes('p1-2') && names[1].includes('p3-3'), names.join(','));
    await shot(page, 'split-s2');
  } finally { await browser.close(); }
});

test('S3: custom ranges 1, 2-3 → 2 files of 1 and 2 pages', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Split Document');
    await chooseMode(page, shell, 'Custom ranges');
    await shell.locator('input[placeholder*="1-10"]').fill('1, 2-3');
    const dl = await saveDownload(page, () => shell.getByRole('button', { name: /Split into 2 files/ }).click());
    const names = await zipEntries(dl);
    ok(t, '2 custom files', names.length === 2, names.join(','));
    ok(t, 'ranges in filenames', names.some((n) => n.includes('p1-1')) && names.some((n) => n.includes('p2-3')));
    await shot(page, 'split-s3');
  } finally { await browser.close(); }
});

test('S4: split at markers on FIXM → 3 chunks each with its MARKER', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page, FIX.fixM);
    const shell = dialog(page, 'Split Document');
    await chooseMode(page, shell, 'At page markers');
    await shell.locator('input[placeholder*="10, 25"]').fill('1, 2');
    const dl = await saveDownload(page, () => shell.getByRole('button', { name: /Split into 3 files/ }).click());
    const names = await zipEntries(dl);
    ok(t, '3 marker chunks', names.length === 3, names.join(','));
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await readFile(dl.path));
    const { PDFDocument } = await import('pdf-lib');
    for (let i = 0; i < names.length; i++) {
      const doc = await PDFDocument.load(await zip.file(names[i]).async('uint8array'));
      ok(t, `chunk ${i + 1} is 1 page`, doc.getPageCount() === 1);
    }
    await shot(page, 'split-s4');
  } finally { await browser.close(); }
});

test('S5: split by TOC bookmarks (outline fixture) → 2 files', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Split Document');
    const tocRadio = shell.locator('input[name="splitMode"]').last();
    await tocRadio.click();
    await page.waitForTimeout(800);
    const btn = shell.getByRole('button', { name: /Split into 2 files/ });
    ok(t, 'TOC split yields 2 files', await btn.isEnabled().catch(() => false));
    const dl = await saveDownload(page, () => btn.click());
    const names = await zipEntries(dl);
    ok(t, '2 TOC files', names.length === 2, names.join(','));
    await shot(page, 'split-s5');
  } finally { await browser.close(); }
});
