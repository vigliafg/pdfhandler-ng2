// P0: Rotate Pages modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, dialog, validatePdf, shot, ok, downloadCurrent } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Rotate'); }

async function setCustomRange(page, shell, value) {
  await shell.getByText('Custom range').click();
  await shell.locator('input[placeholder*="10-20"]').fill(value);
}

/** Execute rotation and wait until the modal is fully gone + doc reloaded. */
async function applyAndWaitClosed(page, shell, btnName) {
  await shell.getByRole('button', { name: btnName }).click();
  await page.locator('div.fixed').getByText('Rotate Pages', { exact: true })
    .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
}

test('R1: rotate page 2 by 90° clockwise', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Rotate Pages');
    await setCustomRange(page, shell, '2');
    await applyAndWaitClosed(page, shell, /Rotate 1 page/);
    const dl = await downloadCurrent(page);
    const info = await validatePdf(await dl.path());
    ok(t, 'page 2 rotated 90', info.rotations[1] === 90, JSON.stringify(info.rotations));
    ok(t, 'other pages untouched', info.rotations[0] === 0 && info.rotations[2] === 0);
    await shot(page, 'rotate-r1');
  } finally { await browser.close(); }
});

test('R2: rotate all pages by 270°', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Rotate Pages');
    await shell.getByText('Counterclockwise 90°').click();
    await applyAndWaitClosed(page, shell, /Rotate 3 pages/);
    const dl = await downloadCurrent(page);
    const info = await validatePdf(await dl.path());
    ok(t, 'all pages rotated 270', info.rotations.every((r) => r === 270), JSON.stringify(info.rotations));
    await shot(page, 'rotate-r2');
  } finally { await browser.close(); }
});

test('R3: two consecutive 90° rotations accumulate to 180°', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Rotate Pages');
    await setCustomRange(page, shell, '1');
    await applyAndWaitClosed(page, shell, /Rotate 1 page/);
    await openTool(page, 'Rotate');
    const shell2 = dialog(page, 'Rotate Pages');
    await setCustomRange(page, shell2, '1');
    await applyAndWaitClosed(page, shell2, /Rotate 1 page/);
    const dl = await downloadCurrent(page);
    const info = await validatePdf(await dl.path());
    ok(t, 'cumulative rotation = 180', info.rotations[0] === 180, JSON.stringify(info.rotations));
    await shot(page, 'rotate-r3');
  } finally { await browser.close(); }
});
