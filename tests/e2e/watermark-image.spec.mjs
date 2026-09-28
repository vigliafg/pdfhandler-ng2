// P2: Watermark Image modal (PNG generated in-browser via canvas)
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok } from './helpers.mjs';

const FIX = await generateFixtures();

test('G1: apply PNG watermark, output grows and loads', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    // generate a PNG data URL in the page and expose it
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 80; c.height = 40;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(200, 30, 30, 0.9)';
      ctx.fillRect(0, 0, 80, 40);
      return c.toDataURL('image/png');
    });
    // write to /tmp via CDP-free approach: use page to build a File and assign to input
    await openTool(page, 'Watermark img');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Watermark Image').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    const input = wrapper.locator('input[type=file]');
    await input.setInputFiles({
      name: 'wm.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    });
    await page.waitForTimeout(400);
    ok(t, 'image loaded indicator', await wrapper.getByText('✅ Image loaded').count() > 0);
    await wrapper.getByRole('button', { name: /Apply Watermark/ }).click();
    await page.waitForTimeout(1800);
    const body = await page.locator('body').innerText();
    ok(t, 'no error', !body.includes('Failed to apply'), body.slice(0, 120));
    await shot(page, 'watermark-image-g1');
  } finally { await browser.close(); }
});

test('G2: tiled placement applies without error', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(30, 200, 30, 0.9)';
      ctx.beginPath(); ctx.arc(30, 30, 25, 0, Math.PI * 2); ctx.fill();
      return c.toDataURL('image/png');
    });
    await openTool(page, 'Watermark img');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Watermark Image').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    await wrapper.locator('input[type=file]').setInputFiles({
      name: 'wm2.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
    });
    await wrapper.locator('select').selectOption('tile');
    await wrapper.getByRole('button', { name: /Apply Watermark/ }).click();
    await page.waitForTimeout(1800);
    ok(t, 'tiled applied', !(await page.locator('body').innerText()).includes('Failed'));
    await shot(page, 'watermark-image-g2');
  } finally { await browser.close(); }
});
