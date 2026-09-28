// P1: Copy / Move Pages modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, dialog, validatePdf, shot, ok, downloadCurrent } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Copy / Move'); }

async function setCustomRange(page, shell, value) {
  await shell.getByText('Custom range').click();
  await shell.locator('input[placeholder*="10-20"]').fill(value);
}

async function apply(page, shell, btnName, title = 'Copy Pages') {
  await shell.getByRole('button', { name: btnName }).click();
  await page.locator('div.fixed').getByText(title, { exact: true })
    .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
}

async function savedBytes(page) {
  const dl = await downloadCurrent(page);
  const { readFile } = await import('node:fs/promises');
  return readFile(await dl.path());
}

async function pageTexts(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    out.push(tc.items.map((x) => x.str).join(' '));
  }
  return out;
}

test('C1: copy page1 ×2 after last → 5 pages with duplicates', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Copy Pages');
    await setCustomRange(page, shell, '1');
    await shell.locator('input[type=number]').last().fill('2'); // Copies = 2
    await apply(page, shell, /Copy 1 page/);
    const bytes = await savedBytes(page);
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    ok(t, 'new total = 5 pages', doc.getPageCount() === 5, `got ${doc.getPageCount()}`);
    const texts = await pageTexts(bytes);
    ok(t, 'page4 duplicates page1', texts[3].includes('FIXA page 1 of 3'), texts[3].slice(0, 40));
    ok(t, 'page5 duplicates page1', texts[4].includes('FIXA page 1 of 3'));
    await shot(page, 'copymove-c1');
  } finally { await browser.close(); }
});

test('C2: move page1 after page3 → order 2,3,1', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Copy Pages');
    await shell.getByRole('button', { name: 'Move Cut & paste pages' }).click();
    await page.waitForTimeout(300);
    // the dialog title changes to "Move Pages" after the toggle
    const mshell = dialog(page, 'Move Pages');
    await setCustomRange(page, mshell, '1');
    // destination: custom page 3, after
    await mshell.getByText('Custom:').click();
    await mshell.locator('input[type=number]').last().fill('3');
    await apply(page, mshell, /Move 1 page/, 'Move Pages');
    const bytes = await savedBytes(page);
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    ok(t, 'total unchanged = 3', doc.getPageCount() === 3);
    const texts = await pageTexts(bytes);
    ok(t, 'order is 2,3,1', texts[0].includes('page 2 of 3') && texts[1].includes('page 3 of 3') && texts[2].includes('page 1 of 3'), texts.map((x) => x.slice(5, 16)).join('|'));
    await shot(page, 'copymove-c2');
  } finally { await browser.close(); }
});
