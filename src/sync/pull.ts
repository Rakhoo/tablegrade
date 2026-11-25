/**
 * Pull: fetches records after the last applied `seq`, decrypts them and writes them
 * into the app tables in one transaction. Records of a newer schema wait in `_sync_pending`.
 */
import { decryptRecord, type RecordPlaintext } from "../crypto/records";
import { SCHEMA_VERSION } from "../db/migrations";
import type { IncomingRecord } from "./api";
import type { SyncContext } from "./context";
import type { ProgressHandler } from "./engine";
import { downloadPhoto, isBlobRef } from "./photos";
import type { SqlRunner, SqlValue } from "./syncDb";
import { readSyncState, writeSyncState } from "./syncState";
import {
  isIdentifier,
  isSyncedKey,
  readRow,
  recordChange,
  SYNCED_TABLES,
  UNIQUE_KEYS,
  whereColumns,
} from "./tables";

/** A pulled record ready to apply. */
type Decoded = { id: string; seq: number; plain: RecordPlaintext };

/** Result of a pull. */
export type PullOutcome = {
  /** Records written into the app tables. */
  applied: number;
  /** Records waiting for an app update. */
  deferred: number;
  /** Ids of all pulled records, including own ones and deletions. */
  ids: string[];
};

/** Key of a row as used in the outbox: table and JSON array of the key values. */
function outboxKey(table: string, pk: unknown[]) {
  return `${table}|${JSON.stringify(pk)}`;
}

/** Photos downloaded at the same time; one at a time is slow over the Funnel. */
const PHOTO_DOWNLOADS = 4;

/** Runs the jobs with at most `limit` at a time; `onDone` follows each finished job. */
async function runLimited(
  jobs: (() => Promise<void>)[],
  limit: number,
  onDone: () => void,
) {
  let next = 0;
  /** Takes jobs until none are left. */
  const worker = async () => {
    while (next < jobs.length) {
      await jobs[next++]();
      onDone();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, worker),
  );
}

/** Decrypted records between two progress reports, so the UI is not redrawn for each. */
const DECRYPT_REPORT_EVERY = 100;

/**
 * Decrypts records and replaces photo references by data URLs. Both count as a progress:
 * records first, then photos, which take the most time.
 */
async function decode(
  ctx: SyncContext,
  records: IncomingRecord[],
  onProgress?: ProgressHandler,
): Promise<Decoded[]> {
  const decoded: Decoded[] = [];
  const photos: (() => Promise<void>)[] = [];
  for (const { id, seq, ciphertext } of records) {
    if (decoded.length % DECRYPT_REPORT_EVERY == 0)
      onProgress?.(decoded.length, records.length);
    const plain = await decryptRecord(ctx.key, ctx.userId, id, ciphertext);
    const { row } = plain;
    if (row && isBlobRef(row.image) && isSyncedKey(plain.t, plain.k)) {
      const { blob } = row.image;
      photos.push(async () => {
        const local = await readRow(ctx.db, plain.t, plain.k);
        row.image = await downloadPhoto(ctx, blob, local?.image);
      });
    }
    decoded.push({ id, seq, plain });
  }
  let done = 0;
  if (photos.length) onProgress?.(0, photos.length, "photos");
  await runLimited(photos, PHOTO_DOWNLOADS, () =>
    onProgress?.(++done, photos.length, "photos"),
  );
  return decoded;
}

/**
 * Settles a clash on a unique index other than the primary key (two devices graded the same
 * lesson). The row with the greater key wins on every device; the loser is deleted and the
 * deletion is pushed. Returns whether the incoming row wins.
 */
async function settleClash(
  tx: SqlRunner,
  { t: table, k: pk, row }: RecordPlaintext,
): Promise<boolean> {
  const unique = UNIQUE_KEYS[table];
  if (!unique || !row) return true;
  const pkColumns = SYNCED_TABLES[table];
  const [clash] = await tx.all(
    `SELECT ${pkColumns.join(", ")} FROM ${table}
      WHERE ${whereColumns(unique)} AND NOT (${whereColumns(pkColumns)})`,
    [...unique.map((column) => row[column] as SqlValue), ...pk],
  );
  if (!clash) return true;
  const clashPk = pkColumns.map((column) => clash[column] as string | number);
  if (JSON.stringify(clashPk) > JSON.stringify(pk)) {
    await recordChange(tx, table, pk);
    return false;
  }
  await tx.run(
    `DELETE FROM ${table} WHERE ${whereColumns(pkColumns)}`,
    clashPk,
  );
  await recordChange(tx, table, clashPk);
  return true;
}

/** Writes one record: deletes the row, or inserts or updates the columns it carries. */
async function applyRecord(tx: SqlRunner, plain: RecordPlaintext) {
  const { t: table, k: pk, row } = plain;
  const pkColumns = SYNCED_TABLES[table];
  if (!row) {
    await tx.run(`DELETE FROM ${table} WHERE ${whereColumns(pkColumns)}`, pk);
    return;
  }
  const columns = Object.keys(row).filter(isIdentifier);
  if (!(await settleClash(tx, plain))) return;
  // Only the carried columns change, so rows of an older schema keep newer local columns
  await tx.run(
    `INSERT INTO ${table} (${columns.join(", ")})
      VALUES (${columns.map(() => "?").join(", ")})
      ON CONFLICT (${pkColumns.join(", ")}) DO UPDATE SET
      ${columns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
    columns.map((column) => row[column] as SqlValue),
  );
}

/**
 * Deletes rows whose parent is gone, e.g. a grade from another device for a student deleted
 * here. Without this the deferred foreign keys would fail the whole transaction.
 */
async function removeOrphans(tx: SqlRunner) {
  const orphans = await tx.all<{ table: string; rowid: number }>(
    "PRAGMA foreign_key_check",
  );
  for (const { table, rowid } of orphans)
    await tx.run(`DELETE FROM ${table} WHERE rowid = ?`, [rowid]);
}

/**
 * Applies decoded records in one transaction with quiet triggers. Rows with a local change in
 * the outbox are skipped: that change is pushed next and wins by its higher `seq`.
 * `finish` runs last inside the same transaction. Returns the number of applied records.
 */
async function applyDecoded(
  ctx: SyncContext,
  decoded: Decoded[],
  finish: (tx: SqlRunner) => Promise<void>,
): Promise<number> {
  return ctx.db.transaction(async (tx) => {
    await writeSyncState(tx, { applying: "1" });
    await tx.run("PRAGMA defer_foreign_keys = ON");
    const changed = new Set(
      (
        await tx.all<{ tbl: string; pk: string }>(
          "SELECT DISTINCT tbl, pk FROM _outbox",
        )
      ).map(({ tbl, pk }) => `${tbl}|${pk}`),
    );
    let applied = 0;
    for (const { id, plain } of decoded) {
      await tx.run("DELETE FROM _sync_pending WHERE id = ?", [id]);
      if (!isSyncedKey(plain.t, plain.k)) continue;
      if (changed.has(outboxKey(plain.t, plain.k))) continue;
      await applyRecord(tx, plain);
      applied++;
    }
    await removeOrphans(tx);
    await finish(tx);
    await writeSyncState(tx, { applying: null });
    return applied;
  });
}

/** Number of records waiting for an app update. */
async function countDeferred(db: SqlRunner): Promise<number> {
  const [{ count }] = await db.all<{ count: number }>(
    "SELECT COUNT(*) AS count FROM _sync_pending WHERE schema > ?",
    [SCHEMA_VERSION],
  );
  return count;
}

/**
 * Pulls all records after `_sync_state.lastSeq` and applies them. All pages go into one
 * transaction, so a child row on an early page never misses its parent from a later page.
 * Own records are skipped; they are already in the local tables. `includeOwn` applies them
 * too, for the pull after a server restore, where the server may hold own rows the device has
 * deleted since. `onProgress` counts decrypted records, then downloaded photos, and gets a
 * total of 0 while writing.
 */
export async function pullChanges(
  ctx: SyncContext,
  onProgress?: ProgressHandler,
  includeOwn = false,
): Promise<PullOutcome> {
  const start = Number((await readSyncState(ctx.db, "lastSeq")) ?? 0);
  // A row changed while paging shows up twice; only its latest record counts
  const latest = new Map<string, IncomingRecord>();
  let after = start;
  for (;;) {
    const page = await ctx.api.pull(after);
    for (const record of page.records) {
      latest.delete(record.id);
      latest.set(record.id, record);
      after = record.seq;
    }
    if (!page.more || !page.records.length) break;
  }
  const records = [...latest.values()];
  const newer = records.filter((record) => record.schema > SCHEMA_VERSION);
  const fresh = records.filter(
    (record) =>
      record.schema <= SCHEMA_VERSION &&
      (includeOwn || record.deviceId != ctx.deviceId),
  );
  const ids = [...latest.keys()];
  if (after == start)
    return { applied: 0, deferred: await countDeferred(ctx.db), ids };
  const applied = await applyDecoded(
    ctx,
    await decode(ctx, fresh, onProgress).then((rows) => {
      // Writing has no count; the UI shows a running bar meanwhile
      onProgress?.(0, 0);
      return rows;
    }),
    async (tx) => {
      for (const record of newer)
        await tx.run(
          "INSERT OR REPLACE INTO _sync_pending (id, seq, schema, record) VALUES (?, ?, ?, ?)",
          [record.id, record.seq, record.schema, JSON.stringify(record)],
        );
      await writeSyncState(tx, { lastSeq: String(after) });
    },
  );
  return { applied, deferred: await countDeferred(ctx.db), ids };
}

/**
 * Applies records that waited for this app version (after an app update). Returns
 * the number of applied records.
 */
export async function applyPending(ctx: SyncContext): Promise<number> {
  const rows = await ctx.db.all<{ record: string }>(
    "SELECT record FROM _sync_pending WHERE schema <= ? ORDER BY seq",
    [SCHEMA_VERSION],
  );
  if (!rows.length) return 0;
  const records = rows.map(
    ({ record }) => JSON.parse(record) as IncomingRecord,
  );
  return applyDecoded(ctx, await decode(ctx, records), async () => {});
}
