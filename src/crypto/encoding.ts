/**
 * Byte encodings of the sync protocol (docs/sync-plan/protocol.md section 1): UTF-8,
 * Base64url without padding and Crockford Base32.
 */

/** Byte array backed by a plain `ArrayBuffer`, as WebCrypto expects it. */
export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Crockford Base32 alphabet (no I, L, O, U). */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** UTF-8 bytes of a string. */
export function utf8(text: string): Bytes {
  return encoder.encode(text) as Bytes;
}

/** String from UTF-8 bytes. */
export function fromUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Concatenates byte arrays (`‖` in the protocol). */
export function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Base64url without padding. */
export function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decodes Base64url with or without padding. Throws on invalid input. */
export function fromBase64url(text: string): Bytes {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Crockford Base32, most significant bit first, no padding. Encodes the first `bits` bits
 * (a multiple of 5, default all bits of `bytes` rounded down).
 */
export function toBase32(bytes: Uint8Array, bits = bytes.length * 8): string {
  let out = "";
  let acc = 0;
  let accBits = 0;
  for (const b of bytes) {
    acc = ((acc << 8) | b) & 0xffff;
    accBits += 8;
    while (accBits >= 5 && out.length < Math.floor(bits / 5)) {
      accBits -= 5;
      out += CROCKFORD[(acc >> accBits) & 31];
    }
  }
  return out;
}

/**
 * Decodes Crockford Base32 that is already normalized (upper case, no separators). Returns
 * the whole bytes; trailing bits that do not fill a byte are dropped.
 */
export function fromBase32(text: string): Bytes {
  const out: number[] = [];
  let acc = 0;
  let accBits = 0;
  for (const char of text) {
    const value = CROCKFORD.indexOf(char);
    if (value < 0) throw new Error(`invalid base32 character: ${char}`);
    acc = ((acc << 5) | value) & 0xffff;
    accBits += 5;
    if (accBits >= 8) {
      accBits -= 8;
      out.push((acc >> accBits) & 0xff);
    }
  }
  return new Uint8Array(out);
}
