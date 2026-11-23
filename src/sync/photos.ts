/**
 * Photos of students as encrypted blobs (protocol.md 5). Locally they stay data URLs in
 * `Students.image`; in records they become `{ blob: <blobId> }`.
 */
import { blobId, decryptBlob, encryptBlob } from "../crypto/records";
import type { SyncContext } from "./context";
import type { SqlRunner } from "./syncDb";

/** A photo reference inside a record plaintext. */
export type BlobRef = { blob: string };

/** Whether a pulled `image` value is a blob reference. */
export function isBlobRef(value: unknown): value is BlobRef {
  return (
    typeof value == "object" &&
    value != null &&
    typeof (value as BlobRef).blob == "string"
  );
}

/** Remembers that the server holds the blob. */
function markKnown(db: SqlRunner, id: string) {
  return db.run("INSERT OR IGNORE INTO _sync_blobs (id) VALUES (?)", [id]);
}

/** Uploads a photo unless the server already has it; returns its blob id. */
export async function uploadPhoto(
  { db, api, key, userId }: SyncContext,
  dataUrl: string,
): Promise<string> {
  const id = await blobId(key, dataUrl);
  const known = await db.all("SELECT 1 FROM _sync_blobs WHERE id = ?", [id]);
  if (known.length) return id;
  await api.putBlob(id, await encryptBlob(key, userId, id, dataUrl));
  await markKnown(db, id);
  return id;
}

/**
 * Returns the data URL of a pulled photo. Uses the local photo when it is the same, so a full
 * download does not fetch unchanged photos again.
 */
export async function downloadPhoto(
  { db, api, key, userId }: SyncContext,
  id: string,
  localImage: unknown,
): Promise<string> {
  if (typeof localImage == "string" && (await blobId(key, localImage)) == id)
    return localImage;
  const dataUrl = await decryptBlob(key, userId, id, await api.getBlob(id));
  await markKnown(db, id);
  return dataUrl;
}
