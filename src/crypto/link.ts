/**
 * Device link crypto (protocol.md section 6): ECDH P-256 key pairs, the link KEK and the
 * check code both devices show.
 */
import { concat, type Bytes } from "./encoding";
import { linkKek } from "./keys";
import { sha256 } from "./primitives";

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

/** Creates a fresh ECDH P-256 key pair for one link. */
export function generateLinkKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH, false, ["deriveBits"]);
}

/** Public key in raw form (uncompressed point, 65 bytes). */
export async function exportPublicKey(key: CryptoKey): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

/** Imports a raw public key of the other device. */
export function importPublicKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, ECDH, false, []);
}

/** KEK of the link from the own private key and the other device's raw public key. */
export async function deriveLinkKek(
  privateKey: CryptoKey,
  otherPublic: Bytes,
): Promise<CryptoKey> {
  const secret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: await importPublicKey(otherPublic) },
    privateKey,
    256,
  );
  return linkKek(new Uint8Array(secret));
}

/**
 * Six-digit check code: first 4 bytes of `SHA-256(pubNew ‖ pubOld)` as big-endian number
 * modulo 1 000 000.
 */
export async function linkCheckCode(
  newPublic: Bytes,
  oldPublic: Bytes,
): Promise<string> {
  const digest = await sha256(concat(newPublic, oldPublic));
  const value = new DataView(digest.buffer).getUint32(0) % 1_000_000;
  return String(value).padStart(6, "0");
}
