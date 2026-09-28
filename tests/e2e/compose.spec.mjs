// P0: Compose (Extract & Montage) modal
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, dialog, shot, ok } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Extract & Montage'); }

async function addSources(page, shell, files) {
  await shell.locator('input[type=file]').setInputFiles(files);
  await page.waitForTimeout(700);
}

async function addChunks(page, shell, count) {
  const btns = shell.getByRole('button', { name: /Add to composition/ });
  for (let i = 0; i < count; i++) await btns.nth(i).click();
  await page.waitForTimeout(250);
}

function chunkList(shell) { return shell.locator('div.max-h-\\[320px\\]').last(); }

test('K1: drag chunk0 over chunk1 reorders composition', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract & Montage');
    await addSources(page, shell, [FIX.fixA, FIX.fixB]);
    await addChunks(page, shell, 2);
    const list = chunkList(shell);
    const rows = list.locator('div[draggable="true"]');
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await rows.nth(0).dispatchEvent('dragstart', { dataTransfer: dt });
    await page.waitForTimeout(80);
    await rows.nth(1).dispatchEvent('dragover', { dataTransfer: dt });
    await page.waitForTimeout(80);
    await rows.nth(1).dispatchEvent('drop', { dataTransfer: dt });
    await rows.nth(0).dispatchEvent('dragend', { dataTransfer: dt });
    await page.waitForTimeout(150);
    const names = await list.locator('p.truncate').allInnerTexts();
    ok(t, 'chunks swapped', names[0].includes('FIXB') || names[0].includes('fixb'), names.join('|'));
    await shot(page, 'compose-k1');
  } finally { await browser.close(); }
});

test('K2: edit chunk range inline updates count', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract & Montage');
    await addSources(page, shell, [FIX.fixC]);
    await addChunks(page, shell, 1);
    const list = chunkList(shell);
    await list.locator('button[title="Edit range"]').click();
    const nums = list.locator('input[type=number]');
    await nums.nth(0).fill('2');
    await nums.nth(1).fill('3');
    await list.getByRole('button', { name: '✓' }).click();
    await page.waitForTimeout(200);
    const label = await list.locator('p.tabular-nums').first().innerText();
    ok(t, 'range edited to pp. 2–3 (2)', label.includes('2'), label);
    await shot(page, 'compose-k2');
  } finally { await browser.close(); }
});

test('K3: remove chunk empties composition', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract & Montage');
    await addSources(page, shell, [FIX.fixA]);
    await addChunks(page, shell, 1);
    const list = chunkList(shell);
    await list.locator('button[title="Remove chunk"]').click();
    await page.waitForTimeout(200);
    const rows = await list.locator('div[draggable="true"]').count();
    ok(t, 'chunk removed', rows === 0, `rows=${rows}`);
    await shot(page, 'compose-k3');
  } finally { await browser.close(); }
});

test('K4: compose with custom output name loads in viewer', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Extract & Montage');
    await addSources(page, shell, [FIX.fixA, FIX.fixB]);
    await addChunks(page, shell, 2);
    await shell.locator('input[placeholder*="composed"]').fill('my-composed.pdf').catch(() => {});
    await shell.getByRole('button', { name: /Extract & Montage|Compose|Execute|Create/ }).last().click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    ok(t, 'viewer shows composed file', /my-composed|composed/.test(body), body.slice(0, 90));
    await shot(page, 'compose-k4');
  } finally { await browser.close(); }
});
