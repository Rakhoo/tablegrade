/**
 * WebCrypto building blocks with the fixed parameters of the sync protocol: HKDF-SHA256 with
 * empty salt and 32 bytes output, AES-256-GCM with 12-byte nonce, HMAC-SHA256 cut to 16 bytes.
 */
import { concat, utf8, type Bytes } from "./encoding";

const NONCE_LENGTH = 12;

/** `n` random bytes from the system CSPRNG. */
export function randomBytes(n: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** SHA-256 of bytes or of the UTF-8 bytes of a string. */
export async function sha256(data: Bytes | string): Promise<Bytes> {
  const bytes = typeof data === "string" ? utf8(data) : data;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

/** HKDF-SHA256 with empty salt, 32 bytes output. */
export async function hkdf(ikm: Bytes, info: string): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: utf8(info),
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Imports 32 raw bytes as an AES-256-GCM key. */
export function importAesKey(
  raw: Bytes,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", extractable, [
    "encrypt",
    "decrypt",
  ]);
}

/** Imports raw bytes as an HMAC-SHA256 key. */
export function importHmacKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** HMAC-SHA256 cut to 16 bytes, as used for record and blob ids. */
export async function hmac16(key: CryptoKey, data: Bytes): Promise<Bytes> {
  const mac = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(mac, 0, 16).slice();
}

/**
 * AES-256-GCM encryption. Returns `nonce ‖ ciphertext ‖ tag`. `nonce` is only passed by tests;
 * normally a fresh random nonce is used.
 */
export async function seal(
  key: CryptoKey,
  plaintext: Bytes,
  aad: string,
  nonce: Bytes = randomBytes(NONCE_LENGTH),
): Promise<Bytes> {
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: utf8(aad) },
    key,
    plaintext,
  );
  return concat(nonce, new Uint8Array(ct));
}

/** Reverses `seal`. Throws if the key, the AAD or the data do not match. */
export async function open(
  key: CryptoKey,
  sealed: Bytes,
  aad: string,
): Promise<Bytes> {
  const pt = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: sealed.subarray(0, NONCE_LENGTH),
      additionalData: utf8(aad),
    },
    key,
    sealed.subarray(NONCE_LENGTH),
  );
  return new Uint8Array(pt);
}
