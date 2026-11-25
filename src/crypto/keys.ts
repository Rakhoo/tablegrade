/**
 * Data key (DEK), id key (IDK) and key wraps (docs/protocol.md section 3).
 */
import type { Bytes } from "./encoding";
import {
  hkdf,
  importAesKey,
  importHmacKey,
  open,
  randomBytes,
  seal,
  sha256,
} from "./primitives";

/** Kinds of wraps; `link` is the one-time wrap of a device link (docs/protocol.md section 6). */
export type WrapKind = "passkey" | "recovery" | "link";

/** The account's data key with the derived id key. Stored as is in IndexedDB. */
export type DataKey = {
  /** AES-256-GCM key for records and blobs; extractable so it can be wrapped again. */
  dek: CryptoKey;
  /** HMAC-SHA256 key for record and blob ids. */
  idk: CryptoKey;
};

const DEK_LENGTH = 32;

/** Builds the data key from 32 raw DEK bytes. */
export async function importDataKey(raw: Bytes): Promise<DataKey> {
  if (raw.length !== DEK_LENGTH) throw new Error("invalid data key length");
  const idkRaw = await hkdf(raw, "notenfeder/record-id/v1");
  return {
    dek: await importAesKey(raw, true),
    idk: await importHmacKey(idkRaw),
  };
}

/** Creates a new random data key for a new account. */
export function generateDataKey(): Promise<DataKey> {
  return importDataKey(randomBytes(DEK_LENGTH));
}

/** The 32 raw DEK bytes, e.g. to wrap them. */
export async function exportDataKey(key: DataKey): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key.dek));
}

/** Fixed PRF input for passkeys: `SHA-256("notenfeder/prf/v1")`. */
export function prfSalt(): Promise<Bytes> {
  return sha256("notenfeder/prf/v1");
}

/** KEK from a 32-byte KEK seed (PRF output, recovery bytes or ECDH secret). */
async function deriveKek(seed: Bytes, info: string): Promise<CryptoKey> {
  return importAesKey(await hkdf(seed, info));
}

/** KEK of a passkey wrap from the PRF output. */
export function passkeyKek(prfOutput: Bytes): Promise<CryptoKey> {
  return deriveKek(prfOutput, "notenfeder/kek/passkey/v1");
}

/** KEK of the recovery wrap from the 20 recovery key bytes. */
export function recoveryKek(recoveryBytes: Bytes): Promise<CryptoKey> {
  return deriveKek(recoveryBytes, "notenfeder/kek/recovery/v1");
}

/** KEK of a device link from the ECDH shared secret. */
export function linkKek(sharedSecret: Bytes): Promise<CryptoKey> {
  return deriveKek(sharedSecret, "notenfeder/link/v1");
}

/** AAD of a wrap. */
function wrapAad(kind: WrapKind, userId: string): string {
  return `notenfeder/wrap/v1/${kind}/${userId}`;
}

/**
 * Wraps the DEK with a KEK. Returns `nonce ‖ ciphertext+tag`. `nonce` is only passed by
 * tests.
 */
export async function wrapDataKey(
  key: DataKey,
  kek: CryptoKey,
  kind: WrapKind,
  userId: string,
  nonce?: Bytes,
): Promise<Bytes> {
  return seal(kek, await exportDataKey(key), wrapAad(kind, userId), nonce);
}

/** Unwraps the DEK. Throws if the KEK is wrong. */
export async function unwrapDataKey(
  wrapped: Bytes,
  kek: CryptoKey,
  kind: WrapKind,
  userId: string,
): Promise<DataKey> {
  return importDataKey(await open(kek, wrapped, wrapAad(kind, userId)));
}
