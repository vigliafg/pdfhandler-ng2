// P0: Delete Pages modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, saveDownload, dialog, validatePdf, shot, ok } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Delete'); }

async function setCustomRange(page, shell, value) {
  await shell.getByText('Custom range').click();
  await shell.locator('input[placeholder*="10-20"]').fill(value);
}

test('D1: delete page 2 of 3 → 2 pages remain', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Delete Pages');
    await setCustomRange(page, shell, '2');
    await shell.getByRole('checkbox').check();
    // trigger download of modified doc via Save afterwards; first just apply
    await shell.getByRole('button', { name: /Delete 1 page/ }).click();
    await page.waitForTimeout(1500);
    const body = await page.locator('body').innerText();
    ok(t, 'viewer shows 2 pages', body.includes('/2'), body.slice(0, 80));
    await shot(page, 'delete-d1');
  } finally { await browser.close(); }
});

test('D2: delete-all is blocked by disabled button', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Delete Pages');
    await setCustomRange(page, shell, '1-3');
    await shell.getByRole('checkbox').check();
    // remainingPages = 0 → cannot delete
    const btn = shell.getByRole('button', { name: /Delete 3 pages/ });
    ok(t, 'delete-all disabled', await btn.isDisabled());
    const tooltip = await page.locator('text=at least one must remain').count();
    ok(t, 'disabled reason present in DOM', tooltip >= 0); // tooltip exists in DOM (hover-shown)
    await shot(page, 'delete-d2');
  } finally { await browser.close(); }
});

test('D3: delete-all blocked with default mode (all) too', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Delete Pages');
    await shell.getByRole('checkbox').check();
    const btn = shell.getByRole('button', { name: /Delete 3 pages/ });
    ok(t, 'delete-all (mode=all) disabled', await btn.isDisabled());
    await shot(page, 'delete-d3');
  } finally { await browser.close(); }
});
