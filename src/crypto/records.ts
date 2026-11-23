/**
 * Record and blob ids and their encryption (protocol.md sections 4 and 5).
 */
import type { DataKey } from "./keys";
import {
  concat,
  fromBase64url,
  fromUtf8,
  toBase64url,
  utf8,
  type Bytes,
} from "./encoding";
import { hmac16, open, seal, sha256 } from "./primitives";

/** Primary key value of a synced row: UUIDs and other text, or a number (`SchoolYears.year`). */
export type KeyValue = string | number;

/** Decrypted content of a record. `row` is `null` for a deletion. */
export type RecordPlaintext = {
  /** SQL table name. */
  t: string;
  /** Primary key values in schema order. */
  k: KeyValue[];
  /** Local schema version of the writer. */
  v: number;
  /** All columns with SQL names, or `null` when deleted. */
  row: Record<string, unknown> | null;
};

/** Record id: `HMAC(IDK, "<table>|<key…>")`, 16 bytes, Base64url. */
export async function recordId(
  key: DataKey,
  table: string,
  pk: KeyValue[],
): Promise<string> {
  const input = [table, ...pk.map(String)].join("|");
  return toBase64url(await hmac16(key.idk, utf8(input)));
}

/** Blob id of a photo: `HMAC(IDK, "blob|" ‖ SHA-256(data URL bytes))`, 16 bytes, Base64url. */
export async function blobId(key: DataKey, dataUrl: string): Promise<string> {
  const hash = await sha256(dataUrl);
  return toBase64url(await hmac16(key.idk, concat(utf8("blob|"), hash)));
}

/** AAD of a record. */
function recordAad(userId: string, id: string): string {
  return `notenfeder/record/v1/${userId}/${id}`;
}

/** AAD of a blob. */
function blobAad(userId: string, id: string): string {
  return `notenfeder/blob/v1/${userId}/${id}`;
}

/**
 * Encrypts a record plaintext. Returns the Base64url `ciphertext` for the push. `nonce` is
 * only passed by tests.
 */
export async function encryptRecord(
  key: DataKey,
  userId: string,
  id: string,
  plaintext: RecordPlaintext,
  nonce?: Bytes,
): Promise<string> {
  const json = utf8(JSON.stringify(plaintext));
  return toBase64url(await seal(key.dek, json, recordAad(userId, id), nonce));
}

/** Decrypts a pulled record. Throws if the key or the id do not match. */
export async function decryptRecord(
  key: DataKey,
  userId: string,
  id: string,
  ciphertext: string,
): Promise<RecordPlaintext> {
  const json = await open(
    key.dek,
    fromBase64url(ciphertext),
    recordAad(userId, id),
  );
  return JSON.parse(fromUtf8(json)) as RecordPlaintext;
}

/** Encrypts a photo (the full data URL) for upload. `nonce` is only passed by tests. */
export function encryptBlob(
  key: DataKey,
  userId: string,
  id: string,
  dataUrl: string,
  nonce?: Bytes,
): Promise<Bytes> {
  return seal(key.dek, utf8(dataUrl), blobAad(userId, id), nonce);
}

/** Decrypts a downloaded photo back into its data URL. */
export async function decryptBlob(
  key: DataKey,
  userId: string,
  id: string,
  data: Bytes,
): Promise<string> {
  return fromUtf8(await open(key.dek, data, blobAad(userId, id)));
}
