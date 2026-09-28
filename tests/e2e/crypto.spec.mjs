// P2: Crypto — encrypt → reload → decrypt roundtrip
import test from 'node:test';
import assert from 'node:assert';
import { generateFixtures } from './fixtures.mjs';
import { launch, launchApp, openTool, shot, ok } from './helpers.mjs';
import { readFile, writeFile, rm } from 'node:fs/promises';

const FIX = await generateFixtures();
const ENC_PATH = '/tmp/e2e-out/secret.pdf.enc';
const PASSWORD = 's3cret-pass';

/** Ensure the encrypted artifact exists (Y3 can run standalone). */
async function ensureEncrypted() {
  try { await readFile(ENC_PATH); return; } catch { /* regenerate below */ }
  // encrypt via Node WebCrypto using the same format as the app (crypto.ts)
  const { webcrypto } = await import('node:crypto');
  const enc = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await webcrypto.subtle.importKey('raw', enc.encode(PASSWORD), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const pdfBytes = await readFile(FIX.fixA);
  const cipher = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pdfBytes);
  const out = new Uint8Array(4 + salt.length + iv.length + cipher.byteLength);
  new DataView(out.buffer).setUint32(0, salt.length, false);
  out.set(salt, 4); out.set(iv, 20); out.set(new Uint8Array(cipher), 32);
  await writeFile(ENC_PATH, out);
}

test('Y1: encrypt downloads .pdf.enc with correct header', async (t) => {
  const { browser, page } = await launch();
  try {
    await launchApp(page, FIX.fixA);
    await openTool(page, 'Cifra');
    await page.waitForTimeout(400);
    const wrapper = page.locator('text=Encrypt PDF').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    const pw = wrapper.locator('input[type=password]');
    await pw.nth(0).fill(PASSWORD);
    await pw.nth(1).fill(PASSWORD);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      wrapper.getByRole('button', { name: /Encrypt & Download/ }).click(),
    ]);
    assert.match(download.suggestedFilename(), /\.pdf\.enc$/);
    const src = await download.path();
    const bytes = await readFile(src);
    await writeFile(ENC_PATH, bytes);
    // header: [4B saltLen BE = 16][salt 16B][IV 12B][ciphertext]
    const saltLen = bytes.readUInt32BE(0);
    ok(t, 'saltLen header = 16', saltLen === 16, `got ${saltLen}`);
    ok(t, 'payload is not a plain PDF', !bytes.subarray(0, 1000).toString('latin1').includes('%PDF-'));
    await shot(page, 'crypto-y1');
  } finally { await browser.close(); }
});

test('Y2: loading .pdf.enc auto-opens Decrypt; wrong password fails with toast', async (t) => {
  const { browser, page } = await launch();
  try {
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      for (const r of regs) await r.unregister();
      for (const k of await caches.keys()) await caches.delete(k);
    });
    await page.locator('#root input[type=file]').first().setInputFiles(ENC_PATH);
    await page.waitForTimeout(800);
    ok(t, 'decrypt modal auto-opened', await page.getByText('Decrypt PDF').count() > 0);
    const wrapper = page.locator('text=Decrypt PDF').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    await wrapper.locator('input[type=password]').fill('wrong-password');
    await wrapper.getByRole('button', { name: /Decrypt & Load/ }).click();
    await page.waitForTimeout(1200);
    const body = await page.locator('body').innerText();
    ok(t, 'decryption error toast/banner', /Decryption failed|Wrong password/i.test(body), body.slice(0, 140));
    await shot(page, 'crypto-y2');
  } finally { await browser.close(); }
});

test('Y3: correct password decrypts and loads viewer', async (t) => {
  await ensureEncrypted();
  const { browser, page } = await launch();
  try {
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      for (const r of regs) await r.unregister();
      for (const k of await caches.keys()) await caches.delete(k);
    });
    await page.locator('#root input[type=file]').first().setInputFiles(ENC_PATH);
    await page.waitForTimeout(800);
    const wrapper = page.locator('text=Decrypt PDF').locator('xpath=ancestor::div[contains(@class,"bg-zinc-900")]').last();
    await wrapper.locator('input[type=password]').fill(PASSWORD);
    await wrapper.getByRole('button', { name: /Decrypt & Load/ }).click();
    await page.waitForSelector('canvas', { timeout: 20000 });
    const body = await page.locator('body').innerText();
    ok(t, 'viewer shows 3 pages', body.includes('1/3') && body.includes('PDF decrypted'), body.slice(0, 100));
    await shot(page, 'crypto-y3');
  } finally { await browser.close(); }
});

test.after?.(async () => { await rm(ENC_PATH, { force: true }); });
