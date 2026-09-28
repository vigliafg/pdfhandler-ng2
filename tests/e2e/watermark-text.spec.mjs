// P2: Watermark Text modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok, downloadCurrent } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

test('W1: DRAFT watermark appears on every page', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Watermark');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Watermark Text').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    await wrapper.locator('input').first().fill('DRAFT-E2E');
    // bump opacity to 1 so text extraction sees it reliably
    await wrapper.locator('input[type=range]').evaluate((el) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '1');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await wrapper.getByRole('button', { name: /Apply Watermark/ }).click();
    await page.locator('div.fixed').getByText('Watermark Text', { exact: true })
      .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const dl = await downloadCurrent(page);
    const bytes = await readFile(await dl.path());
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
    let pages = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      if (tc.items.map((x) => x.str).join(' ').includes('DRAFT-E2E')) pages++;
    }
    ok(t, 'watermark on all 3 pages', pages === 3, `found on ${pages}`);
    await shot(page, 'watermark-text-w1');
  } finally { await browser.close(); }
});

test('W2: angled watermark at low opacity does not crash', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Watermark');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Watermark Text').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    const nums = wrapper.locator('input[type=number]');
    await nums.nth(1).fill('45'); // angle
    await wrapper.getByRole('button', { name: /Apply Watermark/ }).click();
    await page.locator('div.fixed').getByText('Watermark Text', { exact: true })
      .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const body = await page.locator('body').innerText();
    ok(t, 'no error surfaced', !body.includes('Failed to apply'), body.slice(0, 120));
    await shot(page, 'watermark-text-w2');
  } finally { await browser.close(); }
});
