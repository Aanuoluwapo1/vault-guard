import { describe, expect, it } from 'vitest';
import {
  arrayBufferToBase64,
  base64ToUint8Array,
  decryptString,
  deriveKey,
  deriveKeyFingerprint,
  encryptString,
  generateSalt,
} from './subtle';

// Use a faster iteration count in unit tests while still exercising PBKDF2-HMAC-SHA256
const TEST_ITERATIONS = 10_000;

describe('Web Crypto E2EE Engine (subtle.ts)', () => {
  it('derives a non-extractable 256-bit AES-GCM key from passphrase and salt', async () => {
    const salt = generateSalt();
    const key = await deriveKey('correct-horse-battery-staple', salt, TEST_ITERATIONS);

    expect(key.type).toBe('secret');
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('encrypts and decrypts UTF-8 strings cleanly', async () => {
    const salt = 'vault-guard:auditor-1';
    const key = await deriveKey('super-secret-compliance-key', salt, TEST_ITERATIONS);
    const original = JSON.stringify({
      control: 'SOC2-CC6.1',
      status: 'PASS',
      notes: 'Zero-knowledge payload with unicode: 🔒✓',
    });

    const { ciphertext, iv } = await encryptString(key, original);
    expect(ciphertext).not.toBe(original);
    expect(iv.length).toBeGreaterThan(0);

    const decrypted = await decryptString(key, ciphertext, iv);
    expect(decrypted).toBe(original);
  });

  it('generates a fresh random IV on every encryption', async () => {
    const key = await deriveKey('same-passphrase', 'same-salt', TEST_ITERATIONS);
    const payload = 'Identical compliance evidence';

    const enc1 = await encryptString(key, payload);
    const enc2 = await encryptString(key, payload);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it('fails decryption when using a different passphrase', async () => {
    const salt = 'vault-guard:auditor-1';
    const key1 = await deriveKey('passphrase-alpha', salt, TEST_ITERATIONS);
    const key2 = await deriveKey('passphrase-beta', salt, TEST_ITERATIONS);

    const { ciphertext, iv } = await encryptString(key1, 'Top secret audit report');

    await expect(decryptString(key2, ciphertext, iv)).rejects.toThrow(/decryption failed/i);
  });

  it('rejects tampered ciphertext via AES-GCM authentication tag', async () => {
    const key = await deriveKey('integrity-passphrase', 'salt-1', TEST_ITERATIONS);
    const { ciphertext, iv } = await encryptString(key, 'Immutable evidence');

    const bytes = base64ToUint8Array(ciphertext);
    bytes[0] = bytes[0] ^ 0xff; // Flip bits in first byte
    const tamperedB64 = arrayBufferToBase64(bytes);

    await expect(decryptString(key, tamperedB64, iv)).rejects.toThrow(/decryption failed/i);
  });

  it('rejects malformed IV lengths', async () => {
    const key = await deriveKey('passphrase', 'salt', TEST_ITERATIONS);
    const { ciphertext } = await encryptString(key, 'data');
    const shortIv = arrayBufferToBase64(new Uint8Array([1, 2, 3, 4]));

    await expect(decryptString(key, ciphertext, shortIv)).rejects.toThrow(/invalid iv length/i);
  });

  it('produces deterministic display fingerprints without exposing key material', async () => {
    const fp1 = await deriveKeyFingerprint('my-passphrase', 'actor-1');
    const fp2 = await deriveKeyFingerprint('my-passphrase', 'actor-1');
    const fp3 = await deriveKeyFingerprint('other-passphrase', 'actor-1');

    expect(fp1).toMatch(/^VG-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });
});
