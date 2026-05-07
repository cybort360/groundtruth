/**
 * QR/NFC Payload Encryption
 *
 * AES-256-GCM with PBKDF2 key derivation from a user-supplied PIN.
 * Uses the Web Crypto API — no external dependencies.
 * Secure contexts only (HTTPS or localhost).
 *
 * The encrypted payload (v2) is self-describing so older versions of the app
 * can detect it and prompt for a PIN rather than silently failing.
 */

export interface EncryptedQRPayload {
  v: 2;
  enc: true;
  alg: "AES-GCM/PBKDF2-SHA256";
  iter: number;
  salt: string; // hex — random 16 bytes
  iv: string;   // hex — random 12 bytes
  data: string; // base64 of AES-GCM ciphertext (includes 16-byte auth tag)
}

const ITERATIONS  = 100_000; // NIST SP 800-132 recommended minimum
const SALT_BYTES  = 16;
const IV_BYTES    = 12;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

async function deriveKey(
  pin: string,
  salt: Uint8Array,
  iterations: number = ITERATIONS,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  // Cast salt to satisfy strict TypeScript — crypto.subtle expects ArrayBuffer-backed views
  const saltBuf = salt.buffer instanceof ArrayBuffer
    ? salt
    : new Uint8Array(salt);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuf as Uint8Array<ArrayBuffer>, iterations },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt a plain JSON string with a PIN.
 * Returns an EncryptedQRPayload ready to embed in a QR code or NFC tag.
 */
export async function encryptPayload(
  plaintext: string,
  pin: string,
): Promise<EncryptedQRPayload> {
  const salt = new Uint8Array(new ArrayBuffer(SALT_BYTES));
  const iv   = new Uint8Array(new ArrayBuffer(IV_BYTES));
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);
  const key  = await deriveKey(pin, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    v: 2,
    enc: true,
    alg: "AES-GCM/PBKDF2-SHA256",
    iter: ITERATIONS,
    salt: toHex(salt),
    iv: toHex(iv),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

/**
 * Decrypt an EncryptedQRPayload with a PIN.
 * Throws if the PIN is wrong (AES-GCM auth tag mismatch) or data is malformed.
 */
export async function decryptPayload(
  encrypted: EncryptedQRPayload,
  pin: string,
): Promise<string> {
  const salt   = fromHex(encrypted.salt);
  const iv     = fromHex(encrypted.iv);
  const raw    = Uint8Array.from(atob(encrypted.data), (c) => c.charCodeAt(0));
  // Ensure the buffer is a plain ArrayBuffer (not SharedArrayBuffer) for Web Crypto
  const cipher = new Uint8Array(new ArrayBuffer(raw.length));
  cipher.set(raw);
  const ivBuf  = new Uint8Array(new ArrayBuffer(iv.length));
  ivBuf.set(iv);
  const key    = await deriveKey(pin, salt, encrypted.iter);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf as Uint8Array<ArrayBuffer> },
    key,
    cipher as Uint8Array<ArrayBuffer>,
  );
  return new TextDecoder().decode(plaintext);
}

/** Type guard — returns true if the object looks like an encrypted v2 payload. */
export function isEncryptedPayload(obj: unknown): obj is EncryptedQRPayload {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    p.v === 2 &&
    p.enc === true &&
    typeof p.salt === "string" &&
    typeof p.iv   === "string" &&
    typeof p.data === "string"
  );
}

/** True when Web Crypto is available (HTTPS or localhost). */
export function cryptoAvailable(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined"
  );
}
