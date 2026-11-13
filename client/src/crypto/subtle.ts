export const PBKDF2_ITERATIONS = 310_000;
export const AES_KEY_LENGTH = 256;
export const IV_BYTE_LENGTH = 12;
export const SALT_BYTE_LENGTH = 16;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

function getCrypto(): Crypto {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error(
      'Web Crypto API (crypto.subtle) is unavailable. Ensure you are running in a secure context (HTTPS or localhost).'
    );
  }
  return globalThis.crypto;
}

/**
 * Encodes an ArrayBuffer or Uint8Array into a standard Base64 string.
 */
export function arrayBufferToBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array backed by a concrete ArrayBuffer.
 */
export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a cryptographically secure random salt.
 */
export function generateSalt(byteLength: number = SALT_BYTE_LENGTH): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(byteLength);
  const salt = new Uint8Array(buffer);
  getCrypto().getRandomValues(salt);
  return salt;
}

/**
 * Normalizes a salt (either Uint8Array or UTF-8 actor/domain string) to a Uint8Array.
 */
function normalizeSalt(salt: Uint8Array<ArrayBuffer> | string): Uint8Array<ArrayBuffer> {
  if (typeof salt !== 'string') {
    return salt;
  }
  const encoded = new TextEncoder().encode(salt);
  const buffer = new ArrayBuffer(encoded.byteLength);
  const copy = new Uint8Array(buffer);
  copy.set(encoded);
  return copy;
}

/**
 * Derives a non-extractable 256-bit AES-GCM CryptoKey from a user passphrase and salt
 * using PBKDF2-HMAC-SHA256. Passwords and derived keys never leave the client.
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer> | string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  if (!passphrase) {
    throw new Error('Passphrase must not be empty');
  }

  const cryptoApi = getCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: normalizeSalt(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Produces a short, non-reversible display fingerprint for the current vault identity
 * without exposing the passphrase or making the AES-GCM key extractable.
 */
export async function deriveKeyFingerprint(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer> | string
): Promise<string> {
  const cryptoApi = getCrypto();
  const saltBytes = normalizeSalt(salt);
  const passBytes = new TextEncoder().encode(`vault-guard-fp:${passphrase}:`);
  const combined = new Uint8Array(passBytes.byteLength + saltBytes.byteLength);
  combined.set(passBytes, 0);
  combined.set(saltBytes, passBytes.byteLength);

  const digest = await cryptoApi.subtle.digest('SHA-256', combined);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');

  return `VG-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Encrypts raw bytes using AES-GCM-256 with a fresh 96-bit random IV.
 */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>
): Promise<EncryptedPayload> {
  const cryptoApi = getCrypto();
  const ivBuffer = new ArrayBuffer(IV_BYTE_LENGTH);
  const iv = new Uint8Array(ivBuffer);
  cryptoApi.getRandomValues(iv);

  const encrypted = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    plaintext
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypts AES-GCM-256 ciphertext back into raw bytes.
 * Throws if the key is incorrect or the ciphertext/IV was tampered with.
 */
export async function decryptBytes(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string
): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoApi = getCrypto();
  const ciphertext = base64ToUint8Array(ciphertextB64);
  const iv = base64ToUint8Array(ivB64);

  if (iv.byteLength !== IV_BYTE_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_BYTE_LENGTH} bytes, got ${iv.byteLength}`);
  }

  try {
    const decrypted = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      ciphertext
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new Error('Decryption failed: invalid passphrase or corrupted/tampered ciphertext.');
  }
}

/**
 * Encrypts a UTF-8 string using AES-GCM-256.
 */
export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const encoded = new TextEncoder().encode(plaintext);
  const buffer = new ArrayBuffer(encoded.byteLength);
  const bytes = new Uint8Array(buffer);
  bytes.set(encoded);
  return encryptBytes(key, bytes);
}

/**
 * Decrypts AES-GCM-256 ciphertext into a UTF-8 string.
 */
export async function decryptString(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string
): Promise<string> {
  const bytes = await decryptBytes(key, ciphertextB64, ivB64);
  return new TextDecoder().decode(bytes);
}
