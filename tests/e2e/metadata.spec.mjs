// P1: Metadata modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok } from './helpers.mjs';

const FIX = await generateFixtures();

test('T1: set Title and Author, verify in Info afterwards', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Metadata');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Edit Metadata').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    const inputs = wrapper.locator('input');
    await inputs.nth(0).fill('E2E Test Title');
    await inputs.nth(1).fill('Viglia Bot');
    await wrapper.getByRole('button', { name: /Apply Metadata/ }).click();
    await page.waitForTimeout(1200);
    // reopen Info to verify
    await openTool(page, 'Info');
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    ok(t, 'title persisted', body.includes('E2E Test Title'));
    ok(t, 'author persisted', body.includes('Viglia Bot'));
    await shot(page, 'metadata-t1');
  } finally { await browser.close(); }
});
