// P1: Export PNG (instant tool, no modal)
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok } from './helpers.mjs';
import { readFile } from 'node:fs/promises';

const FIX = await generateFixtures();

test('X1: export produces ZIP with 3 valid PNGs', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.waitForSelector('nav', { timeout: 5000 });
    for (const section of await page.locator('nav button.uppercase').all()) await section.click();
    await page.waitForTimeout(300);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('nav').getByText('Esporta PNG', { exact: true }).click(),
    ]);
    const zipPath = await download.path();
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const names = Object.keys(zip.files).filter((n) => n.endsWith('.png'));
    ok(t, '3 PNG entries', names.length === 3, names.join(','));
    for (const n of names) {
      const bytes = await zip.file(n).async('uint8array');
      ok(t, `${n} is a real PNG`, bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);
      ok(t, `${n} reasonably sized`, bytes.length > 5000, `${bytes.length}B`);
    }
    await shot(page, 'exportpng-x1');
  } finally { await browser.close(); }
});
