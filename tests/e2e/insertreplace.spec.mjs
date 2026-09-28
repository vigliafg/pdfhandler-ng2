// P1: Insert / Replace Pages modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, dialog, shot, ok, downloadCurrent } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Insert / Replace'); }

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

async function savedBytes(page) {
  const dl = await downloadCurrent(page);
  const { readFile } = await import('node:fs/promises');
  return readFile(await dl.path());
}

test('I1: insert FIXB after page 2 → A1,A2,B1,B2,A3', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Insert / Replace Pages');
    await shell.locator('input[type=file]').setInputFiles(FIX.fixB);
    await page.waitForTimeout(500);
    // destination: custom page 2, after
    await shell.getByText('Custom:').click();
    await shell.locator('input[type=number]').last().fill('2');
    await shell.getByRole('button', { name: 'Insert', exact: true }).last().click();
    await page.locator('div.fixed').getByText('Insert / Replace Pages', { exact: true })
      .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    const bytes = await savedBytes(page);
    const texts = await pageTexts(bytes);
    ok(t, '5 pages after insert', texts.length === 5, `got ${texts.length}`);
    ok(t, 'order A1,A2,B1,B2,A3',
      texts[0].includes('FIXA page 1') && texts[1].includes('FIXA page 2') &&
      texts[2].includes('FIXB page 1') && texts[3].includes('FIXB page 2') &&
      texts[4].includes('FIXA page 3'), texts.map((x) => x.slice(0, 14)).join('|'));
    await shot(page, 'insertreplace-i1');
  } finally { await browser.close(); }
});

test('I2: replace pages 2-3 with FIXB → A1,B1,B2', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Insert / Replace Pages');
    await shell.getByRole('button', { name: 'Replace' }).click();
    await shell.getByText('Custom range').first().click();
    await shell.locator('input[placeholder*="10-20"]').first().fill('2-3');
    await shell.locator('input[type=file]').setInputFiles(FIX.fixB);
    await page.waitForTimeout(500);
    await shell.getByRole('button', { name: 'Replace', exact: true }).last().click();
    await page.locator('div.fixed').getByText('Insert / Replace Pages', { exact: true })
      .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    const bytes = await savedBytes(page);
    const texts = await pageTexts(bytes);
    ok(t, '3 pages after replace', texts.length === 3, `got ${texts.length}`);
    ok(t, 'content A1,B1,B2',
      texts[0].includes('FIXA page 1') && texts[1].includes('FIXB page 1') && texts[2].includes('FIXB page 2'),
      texts.map((x) => x.slice(0, 14)).join('|'));
    await shot(page, 'insertreplace-i2');
  } finally { await browser.close(); }
});

test('I3: execute disabled without source file', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Insert / Replace Pages');
    const btn = shell.getByRole('button', { name: 'Insert', exact: true }).last();
    ok(t, 'disabled without source', await btn.isDisabled());
    await shot(page, 'insertreplace-i3');
  } finally { await browser.close(); }
});
