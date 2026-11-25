/**
 * Turning sync on and off in the app database. Device store and server session are
 * handled by the caller.
 */
import { DEVICE_SETTING_KEYS } from "../lib/settings";
import type { SqlRunner, SyncDb } from "./syncDb";
import { writeSyncState } from "./syncState";
import { clearSyncTables, SYNCED_TABLES } from "./tables";

/** `WHERE` clause and parameters that leave out device settings, which are never synced. */
function syncedRows(table: string): [string, string[]] {
  if (table != "Settings") return ["", []];
  const marks = DEVICE_SETTING_KEYS.map(() => "?").join(", ");
  return [` WHERE key NOT IN (${marks})`, [...DEVICE_SETTING_KEYS]];
}

/** Adds the key of every synced row to the outbox, so the next push uploads everything. */
export async function enqueueAllRows(db: SqlRunner): Promise<void> {
  const now = Date.now();
  for (const [table, pk] of Object.entries(SYNCED_TABLES)) {
    const [where, params] = syncedRows(table);
    await db.run(
      `INSERT INTO _outbox (tbl, pk, changedAt)
        SELECT ?, json_array(${pk.join(", ")}), ? FROM ${table}${where}`,
      [table, now, ...params],
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

/**
 * Joins an account that already has data: the synced local rows go, nothing is queued and the
 * next pull downloads everything from `seq` 0. Device settings stay.
 */
export function joinAccount(db: SyncDb, syncId: string): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.run("PRAGMA defer_foreign_keys = ON");
    await clearSyncTables(tx);
    // Sync is still off here, so the outbox triggers stay quiet
    for (const table of Object.keys(SYNCED_TABLES).reverse()) {
      const [where, params] = syncedRows(table);
      await tx.run(`DELETE FROM ${table}${where}`, params);
    }
    await writeSyncState(tx, { enabled: "1", lastSeq: "0", syncId });
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
