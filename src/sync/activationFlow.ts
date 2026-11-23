/**
 * When and how a signed-in, unlocked device starts syncing (plan B6). A new account uploads
 * the local data; an account with data replaces the local data, after the user agreed if the
 * device has own data.
 */
import { joinAccount, turnOn } from "./activation";
import type { Api, KeyWrap } from "./api";
import type { DeviceStore } from "./deviceStore";
import type { SyncDb } from "./syncDb";
import { readSyncState } from "./syncState";

/** Whether sync on this device is active for `userId` (database and device store agree). */
export async function isActivated(
  db: SyncDb,
  store: DeviceStore,
  userId: string,
): Promise<boolean> {
  const syncId = await store.get("syncId");
  if (!syncId || (await store.get("syncUserId")) != userId) return false;
  return (
    (await readSyncState(db, "enabled")) == "1" &&
    (await readSyncState(db, "syncId")) == syncId
  );
}

/** Whether the device has own data (classes or students); settings alone do not count. */
export async function hasLocalRows(db: SyncDb): Promise<boolean> {
  const [{ found }] = await db.all<{ found: number }>(
    "SELECT EXISTS (SELECT 1 FROM Classes) OR EXISTS (SELECT 1 FROM Students) AS found",
  );
  return !!found;
}

/**
 * Activates sync for `userId`. Waits (returns `false`) while the account has no recovery key,
 * i.e. its setup is not finished, and while an account with data would replace own local data
 * without `replace`. An empty account gets all local rows uploaded.
 */
export async function activateSync(
  { db, store, api }: { db: SyncDb; store: DeviceStore; api: Api },
  userId: string,
  keys: KeyWrap[],
  replace: boolean,
): Promise<boolean> {
  if (!keys.some((wrap) => wrap.kind == "recovery")) return false;
  const serverEmpty = (await api.pull(0, 1)).records.length == 0;
  if (!serverEmpty && !replace && (await hasLocalRows(db))) return false;
  const syncId = crypto.randomUUID();
  await (serverEmpty ? turnOn(db, syncId) : joinAccount(db, syncId));
  await store.set("syncId", syncId);
  await store.set("syncUserId", userId);
  return true;
}
