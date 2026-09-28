// P0: Info modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok } from './helpers.mjs';

const FIX = await generateFixtures();

test('N1: info shows page count and file size, closes cleanly', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Info');
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    ok(t, 'title includes filename', body.includes('Info: fixa.pdf'));
    ok(t, 'pages = 3', /Pages\s*\n?\s*3/.test(body), body.slice(0, 200));
    ok(t, 'file size shown', /File size/.test(body));
    await shot(page, 'info-n1');
    // close via ×
    await page.locator('div.fixed').getByRole('button').first().click();
    await page.waitForTimeout(300);
    const after = await page.locator('body').innerText();
    ok(t, 'modal closed', !after.includes('Info: fixa.pdf'));
  } finally { await browser.close(); }
});
