// P1: Page Numbers modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok, downloadCurrent } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

test('P1: page numbers "Page 1 of 3" appear on every page', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Numera pagine');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Page Numbers').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    await wrapper.getByRole('button', { name: /Add Page Numbers/ }).click();
    await page.locator('div.fixed').getByText('Page Numbers', { exact: true })
      .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const dl = await downloadCurrent(page);
    const bytes = await readFile(await dl.path());
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
    let hits = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      const txt = tc.items.map((x) => x.str).join(' ');
      if (txt.includes(`Page ${i} of 3`)) hits++;
    }
    ok(t, 'page numbers on all 3 pages', hits === 3, `hits=${hits}`);
    await shot(page, 'pagenumbers-p1');
  } finally { await browser.close(); }
});
