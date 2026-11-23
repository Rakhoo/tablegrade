/**
 * Turning sync on and off in the app database (plan B5). Device store and server session are
 * handled by the caller.
 */
import { DEVICE_SETTING_KEYS } from "../lib/settings";
import type { SqlRunner, SyncDb } from "./syncDb";
import { writeSyncState } from "./syncState";
import { clearSyncTables, SYNCED_TABLES } from "./tables";

/** Adds the key of every synced row to the outbox, so the next push uploads everything. */
export async function enqueueAllRows(db: SqlRunner): Promise<void> {
  const now = Date.now();
  for (const [table, pk] of Object.entries(SYNCED_TABLES)) {
    const deviceFilter =
      table == "Settings"
        ? ` WHERE key NOT IN (${DEVICE_SETTING_KEYS.map(() => "?").join(", ")})`
        : "";
    await db.run(
      `INSERT INTO _outbox (tbl, pk, changedAt)
        SELECT ?, json_array(${pk.join(", ")}), ? FROM ${table}${deviceFilter}`,
      [table, now, ...(deviceFilter ? DEVICE_SETTING_KEYS : [])],
    );
  }
}

/**
 * Turns sync on: fresh sync tables, `lastSeq` 0 and all rows queued for the first upload.
 * `syncId` marks this activation for the import guard.
 */
export function turnOn(db: SyncDb, syncId: string): Promise<void> {
  return db.transaction(async (tx) => {
    await clearSyncTables(tx);
    await writeSyncState(tx, { enabled: "1", lastSeq: "0", syncId });
    await enqueueAllRows(tx);
  });
}

/** Turns sync off; the app data stays, only the sync bookkeeping goes. */
export function turnOff(db: SyncDb): Promise<void> {
  return db.transaction(async (tx) => {
    await writeSyncState(tx, {
      enabled: "0",
      applying: null,
      lastSeq: null,
      syncId: null,
    });
    await clearSyncTables(tx);
  });
}
