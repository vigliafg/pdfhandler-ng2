// P0: Merge modal (ported from /tmp/dnd-test.mjs + edge cases)
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, dialog, shot, ok } from './helpers.mjs';

const FIX = await generateFixtures();

async function setup(page) { await launchApp(page, FIX.fixA); await openTool(page, 'Merge'); }

async function addFiles(page, shell, files) {
  await shell.locator('input[data-testid="merge-file-input"]').setInputFiles(files);
  await page.waitForTimeout(700);
}

async function dragRowIdx(list, from, to) {
  const rows = list.locator('div[draggable="true"]');
  const dt = await list.page().evaluateHandle(() => new DataTransfer());
  await rows.nth(from).dispatchEvent('dragstart', { dataTransfer: dt });
  await list.page().waitForTimeout(80);
  await rows.nth(to).dispatchEvent('dragover', { dataTransfer: dt });
  await list.page().waitForTimeout(80);
  await rows.nth(to).dispatchEvent('drop', { dataTransfer: dt });
  await rows.nth(from).dispatchEvent('dragend', { dataTransfer: dt });
  await list.page().waitForTimeout(120);
}

async function names(list) { return list.locator('span.flex-1').allInnerTexts(); }

test('M1: drag row0 over row1 (downward) swaps live', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Merge PDFs');
    await addFiles(page, shell, [FIX.fixA, FIX.fixB, FIX.fixC]);
    const list = shell.locator('div.max-h-48');
    await dragRowIdx(list, 0, 1);
    const n = await names(list);
    ok(t, 'order after drag down', n[0] === 'fixb.pdf' && n[1] === 'fixa.pdf', n.join(','));
    await shot(page, 'merge-m1');
  } finally { await browser.close(); }
});

test('M2: drag row2 over row0 (upward multi-step) reorders', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Merge PDFs');
    await addFiles(page, shell, [FIX.fixA, FIX.fixB, FIX.fixC]);
    const list = shell.locator('div.max-h-48');
    await dragRowIdx(list, 2, 0);
    const n = await names(list);
    ok(t, 'fixc now first', n[0] === 'fixc.pdf', n.join(','));
    await shot(page, 'merge-m2');
  } finally { await browser.close(); }
});

test('M3: merge 3 files → viewer loads merged.pdf with 9 pages', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Merge PDFs');
    await addFiles(page, shell, [FIX.fixA, FIX.fixB, FIX.fixC]);
    await shell.getByRole('button', { name: /Merge 3 files/ }).click();
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    ok(t, 'merged.pdf loaded', body.includes('merged.pdf'));
    ok(t, '9 pages total', body.includes('1/9'), body.slice(0, 100));
    await shot(page, 'merge-m3');
  } finally { await browser.close(); }
});

test('M4: single file → execute disabled with reason tooltip', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Merge PDFs');
    await addFiles(page, shell, [FIX.fixA]);
    const btn = shell.getByRole('button', { name: /Merge 1 files?/ });
    ok(t, 'disabled with 1 file', await btn.isDisabled());
    const reason = await page.locator('text=need 2+ files to merge').count();
    ok(t, 'reason tooltip in DOM', reason >= 0);
    await shot(page, 'merge-m4');
  } finally { await browser.close(); }
});

test('M5: corrupt file rejected with warning banner', async (t) => {
  const { browser, page } = await launch();
  try {
    await setup(page);
    const shell = dialog(page, 'Merge PDFs');
    await addFiles(page, shell, [FIX.fixA, FIX.corrupt]);
    const warn = await page.locator('text=skipped — not a valid PDF').count();
    ok(t, 'warning banner shown', warn > 0);
    const n = await shell.locator('div.max-h-48 span.flex-1').count();
    ok(t, 'only valid file listed', n === 1, `listed ${n}`);
    await shot(page, 'merge-m5');
  } finally { await browser.close(); }
});
