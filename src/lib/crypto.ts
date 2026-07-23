/**
 * PDF encryption/decryption using Web Crypto API (AES-GCM + PBKDF2).
 *
 * Format of .pdf.enc file:
 *   [4 bytes: salt length][salt bytes][12 bytes: IV][encrypted PDF bytes]
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 100_000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt PDF bytes with a password.
 * Returns the encrypted data with salt and IV prepended.
 */
export async function encryptPDF(
  pdfBytes: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH)) as Uint8Array;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)) as Uint8Array;
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    key,
    pdfBytes as BufferSource,
  );

  // Encode: [4-byte salt length BE][salt][iv][ciphertext]
  const saltLenBuf = new ArrayBuffer(4);
  new DataView(saltLenBuf).setUint32(0, salt.length, false); // big-endian
  const saltLen = new Uint8Array(saltLenBuf);
  const result = new Uint8Array(4 + salt.length + iv.length + encrypted.byteLength);
  result.set(saltLen, 0);
  result.set(salt, 4);
  result.set(iv, 4 + salt.length);
  result.set(new Uint8Array(encrypted), 4 + salt.length + iv.length);

  return result;
}

/**
 * Decrypt PDF bytes with a password.
 * Expects the format: [4-byte salt length BE][salt][iv][ciphertext]
 */
export async function decryptPDF(
  encryptedBytes: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  // Extract salt length (first 4 bytes, big-endian uint32)
  const saltLenView = new DataView(encryptedBytes.buffer, encryptedBytes.byteOffset, 4);
  const saltLen = saltLenView.getUint32(0, false);

  const salt = new Uint8Array(encryptedBytes.slice(4, 4 + saltLen));
  const iv = new Uint8Array(encryptedBytes.slice(4 + saltLen, 4 + saltLen + IV_LENGTH));
  const ciphertext = encryptedBytes.slice(4 + saltLen + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );

  return new Uint8Array(decrypted);
}

/**
 * Check if a file looks like an encrypted PDF (.pdf.enc).
 */
export function isEncryptedPDF(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf.enc');
}
