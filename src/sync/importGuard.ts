/**
 * Detects a database that came from a backup import. Such a file carries the sync state of
 * the moment of export (possibly of another device), so sync on it must start from scratch.
 */
import type { DeviceStore } from "./deviceStore";
import type { SyncDb } from "./syncDb";
import { turnOff } from "./activation";
import { readSyncState } from "./syncState";

/**
 * Result of the check:
 * - `ok`: database and device agree.
 * - `reset`: the database had stale sync state; it was cleared, sync was not active here.
 * - `disabled`: sync was active on this device and is now off; the UI shows a hint.
 */
export type ImportCheck = "ok" | "reset" | "disabled";

/**
 * Compares `_sync_state.syncId` with the device store. On a mismatch it turns sync off in
 * both places and clears the sync tables. The data key stays, so turning sync on again for the
 * same account needs no unlock; the server session ends locally. Runs at engine start.
 */
export async function checkImportedDatabase(
  db: SyncDb,
  store: DeviceStore,
): Promise<ImportCheck> {
  const deviceSyncId = (await store.get("syncId")) ?? null;
  const databaseSyncId = await readSyncState(db, "syncId");
  if (deviceSyncId == databaseSyncId) return "ok";
  await turnOff(db);
  if (deviceSyncId == null) return "reset";
  await store.delete("syncId");
  await store.delete("session");
  await store.set("importNotice", true);
  return "disabled";
}
