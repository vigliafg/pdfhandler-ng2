// P0: Extract Text (instant tool)
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, shot, ok } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

test('L1: extracted txt contains page markers and labels', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    // expand drawer + open tool (section expansion is part of the flow)
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.waitForSelector('nav', { timeout: 5000 });
    for (const section of await page.locator('nav button.uppercase').all()) await section.click();
    await page.waitForTimeout(300);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.locator('nav').getByText('Estrai testo', { exact: true }).click(),
    ]);
    const txtPath = await download.path();
    const txt = await readFile(txtPath, 'utf8');
    ok(t, 'has page separators', txt.includes('--- Page 1 ---') && txt.includes('--- Page 3 ---'));
    ok(t, 'has FIXA labels', txt.includes('FIXA page 1 of 3') && txt.includes('FIXA page 3 of 3'));
    await shot(page, 'extracttext-l1');
  } finally { await browser.close(); }
});
