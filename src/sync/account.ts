/**
 * Deleting the account (plan B6). The server data goes; on this device only the sync
 * bookkeeping and the device store go, the app data stays.
 */
import { turnOff } from "./activation";
import type { KeyringContext } from "./keyring";
import type { SyncDb } from "./syncDb";

/**
 * Deletes the account on the server, then turns sync off and removes session and data key
 * here. If the server call fails, nothing changes locally.
 */
export async function deleteAccount(
  { api, store }: KeyringContext,
  db: SyncDb,
): Promise<void> {
  await api.deleteAccount();
  await turnOff(db);
  await store.clear();
}
