/**
 * Access to `_sync_state` in the app database. It holds only non-secret progress, because
 * the table is part of every backup export; secrets live in the device store.
 */
import type { SqlRunner } from "./syncDb";

/**
 * Keys of `_sync_state`:
 * - `enabled`: `'1'` while sync is on; the outbox triggers record changes only then.
 * - `applying`: `'1'` while the engine writes incoming rows; the triggers then stay quiet.
 * - `lastSeq`: highest server `seq` applied locally. Stored here, not in IndexedDB, so it
 *   commits in the same transaction as the pulled rows.
 * - `syncId`: random id of the current activation; compared with the device store to detect
 *   an imported backup.
 */
export type SyncStateKey = "enabled" | "applying" | "lastSeq" | "syncId";

/** Reads one value; `null` if missing. */
export async function readSyncState(
  db: SqlRunner,
  key: SyncStateKey,
): Promise<string | null> {
  const [row] = await db.all<{ value: string | null }>(
    "SELECT value FROM _sync_state WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

/** Writes values; `null` removes the key. */
export async function writeSyncState(
  db: SqlRunner,
  values: Partial<Record<SyncStateKey, string | null>>,
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await (value == null
      ? db.run("DELETE FROM _sync_state WHERE key = ?", [key])
      : db.run(
          "INSERT INTO _sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
          [key, value],
        ));
  }
}
