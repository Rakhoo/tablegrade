/**
 * Push (plan B5): sends the rows behind the outbox keys as encrypted records. The outbox only
 * holds keys; the current row is read at send time, a missing row is sent as deleted.
 */
import { encryptRecord, recordId, type KeyValue } from "../crypto/records";
import { SCHEMA_VERSION } from "../db/migrations";
import type { OutgoingRecord } from "./api";
import type { SyncContext } from "./context";
import { uploadPhoto } from "./photos";
import { isSyncedKey, readRow } from "./tables";

/** Outbox entries per push; the server takes at most 500 records. */
export const PUSH_BATCH = 500;

/** One `_outbox` row. */
type OutboxEntry = { seq: number; tbl: string; pk: string };

/** Builds the encrypted record for the current state of one row. */
async function buildRecord(
  ctx: SyncContext,
  table: string,
  pk: KeyValue[],
): Promise<OutgoingRecord> {
  const row = await readRow(ctx.db, table, pk);
  const blobs: string[] = [];
  if (row && table == "Students" && typeof row.image == "string") {
    const blob = await uploadPhoto(ctx, row.image);
    row.image = { blob };
    blobs.push(blob);
  }
  const id = await recordId(ctx.key, table, pk);
  const plaintext = { t: table, k: pk, v: SCHEMA_VERSION, row };
  return {
    id,
    deleted: row == null,
    schema: SCHEMA_VERSION,
    ciphertext: await encryptRecord(ctx.key, ctx.userId, id, plaintext),
    blobs,
  };
}

/**
 * Sends all outbox entries in batches and removes them after the server accepted them.
 * Changes made meanwhile get a higher outbox `seq` and stay for the next push.
 * `onBatch` gets the number of entries sent so far. Returns that number.
 */
export async function pushChanges(
  ctx: SyncContext,
  onBatch?: (sent: number) => void,
): Promise<number> {
  let sent = 0;
  for (;;) {
    const entries = await ctx.db.all<OutboxEntry>(
      "SELECT seq, tbl, pk FROM _outbox ORDER BY seq LIMIT ?",
      [PUSH_BATCH],
    );
    if (!entries.length) return sent;
    // Several changes of one row in a batch become one record
    const keys = new Map(
      entries.map((entry) => [`${entry.tbl}|${entry.pk}`, entry]),
    );
    const records: OutgoingRecord[] = [];
    for (const { tbl, pk } of keys.values()) {
      const values = JSON.parse(pk) as KeyValue[];
      if (isSyncedKey(tbl, values))
        records.push(await buildRecord(ctx, tbl, values));
    }
    if (records.length) await ctx.api.push(records);
    const last = entries[entries.length - 1];
    await ctx.db.run("DELETE FROM _outbox WHERE seq <= ?", [last.seq]);
    sent += entries.length;
    onBatch?.(sent);
  }
}
