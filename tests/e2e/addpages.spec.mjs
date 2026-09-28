// P1: Add Blank Pages modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok, downloadCurrent } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

test('B1: add 2 blank A4 pages at end → 5 pages, last two blank', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Aggiungi pagine');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Add Blank Pages').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    await wrapper.locator('input[type=number]').fill('2');
    await wrapper.getByRole('button', { name: /Add Pages/ }).click();
    await page.locator('div.fixed').getByText('Add Blank Pages', { exact: true })
      .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const body = await page.locator('body').innerText();
    ok(t, 'viewer shows 5 pages', body.includes('1/5'), body.slice(0, 100));
    const dl = await downloadCurrent(page);
    const bytes = await readFile(await dl.path());
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
    ok(t, 'download has 5 pages', doc.numPages === 5, `got ${doc.numPages}`);
    const last = await (await doc.getPage(5)).getTextContent();
    ok(t, 'last page has no text', last.items.filter((i) => i.str.trim()).length === 0);
    const vp = (await doc.getPage(5)).getViewport({ scale: 1 });
    ok(t, 'new page is A4', Math.round(vp.width) === 595 && Math.round(vp.height) === 842, `${vp.width}x${vp.height}`);
    await shot(page, 'addpages-b1');
  } finally { await browser.close(); }
});
