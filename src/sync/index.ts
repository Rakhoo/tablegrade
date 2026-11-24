/**
 * Public facade of account, encryption and sync (docs/sync-plan). The UI uses only this
 * module. Built with `VITE_SYNC_DEMO=true`, it returns sample values instead.
 */
import { syncDb } from "../db/queries/syncDb";
import { createApi } from "./api";
import { SYNC_URL } from "./config";
import { demo } from "./demo";
import { createIndexedDbStore } from "./deviceStore";
import { createSyncService, type SyncService } from "./service";
import { addStatusListener, readStatus } from "./status";
import type {
  Device,
  DeviceLinkApproval,
  OidcProvider,
  PendingDeviceLink,
} from "./types";

export type * from "./types";

/** Build-time switch; Vite inlines it, so the demo is dropped from normal builds. */
const DEMO = import.meta.env.VITE_SYNC_DEMO === "true";

let service: SyncService | null = null;

/** The real service, created on first use. Throws if the build has no sync server. */
function real(): SyncService {
  if (!SYNC_URL)
    throw new Error("Für diese Version gibt es keinen Sync-Server.");
  service ??= createSyncService({
    db: syncDb,
    store: createIndexedDbStore(),
    createApi: (getToken) => createApi({ baseUrl: SYNC_URL, getToken }),
    storage: localStorage,
    currentUrl: () => location.href,
    navigate: (url) => location.assign(url),
    replaceUrl: (url) => history.replaceState(null, "", url),
    monitorTargets: { window, document },
  });
  return service;
}

/**
 * Starts sync when the app opens: checks for an imported backup, finishes an OIDC return and
 * starts the session checks and the engine. Does nothing in builds without a sync server; the
 * demo only shows the import hint.
 */
export async function startSync(): Promise<void> {
  if (DEMO) return demo.start();
  if (!SYNC_URL) return;
  await real().start();
}

/**
 * Calls `listener` after data from other devices was written, so the app reloads its data;
 * returns the function to unsubscribe.
 */
export function subscribeSyncApplied(listener: () => void): () => void {
  if (DEMO || !SYNC_URL) return () => {};
  return real().subscribeApplied(listener);
}

/** Current sync status snapshot. */
export const getSyncStatus = readStatus;

/** Calls `listener` on every status change; returns the function to unsubscribe. */
export const subscribeSyncStatus = addStatusListener;

/** Turns sync on for this device. The status becomes `signedOut` until a sign-in. */
export async function enableSync(): Promise<void> {
  return DEMO ? demo.enableSync() : real().enableSync();
}

/** Turns sync off. Local data stays; the session on the server ends. */
export async function disableSync(): Promise<void> {
  return DEMO ? demo.disableSync() : real().disableSync();
}

/**
 * Starts the OIDC login with Microsoft or Google. Navigates away; the app finishes the login
 * when the provider redirects back.
 */
export async function startOidcLogin(
  provider: OidcProvider,
  deviceName: string,
): Promise<void> {
  return DEMO
    ? demo.startOidcLogin(provider, deviceName)
    : real().startOidcLogin(provider, deviceName);
}

/**
 * Links a Microsoft or Google account to the signed-in account. Navigates away like
 * `startOidcLogin`; the return links the identity instead of signing in.
 */
export async function linkOidcIdentity(provider: OidcProvider): Promise<void> {
  return DEMO
    ? demo.linkOidcIdentity(provider)
    : real().linkOidcIdentity(provider);
}

/** Adds a passkey on this device and wraps the data key for it when it supports PRF. */
export async function addPasskey(): Promise<void> {
  return DEMO ? demo.addPasskey() : real().addPasskey();
}

/** Unlocks the data key with a passkey that supports PRF. */
export async function unlockWithPasskey(): Promise<void> {
  return DEMO ? demo.unlockWithPasskey() : real().unlockWithPasskey();
}

/**
 * Unlocks the data key with the recovery key as typed by the user (any case, with or without
 * dashes). Throws with a German message on typos or a wrong key.
 */
export async function unlockWithRecoveryKey(text: string): Promise<void> {
  return DEMO
    ? demo.unlockWithRecoveryKey(text)
    : real().unlockWithRecoveryKey(text);
}

/**
 * Creates a new recovery key and replaces the old one on the server. Returns the text to show
 * once, e.g. `K7QF-M2XA-…`. For a new account this also creates the data key.
 */
export async function createRecoveryKey(): Promise<string> {
  return DEMO ? demo.createRecoveryKey() : real().createRecoveryKey();
}

/** Starts linking on the new device (signed in, but locked). */
export async function startDeviceLink(): Promise<PendingDeviceLink> {
  return DEMO ? demo.startDeviceLink() : real().startDeviceLink();
}

/** Looks up a link code on the old device (unlocked). */
export async function confirmDeviceLink(
  code: string,
): Promise<DeviceLinkApproval> {
  return DEMO ? demo.confirmDeviceLink(code) : real().confirmDeviceLink(code);
}

/** Lists all devices of the account, including revoked ones. */
export async function listDevices(): Promise<Device[]> {
  return DEMO ? demo.listDevices() : real().listDevices();
}

/** Renames a device of the account, e.g. "iPad Schule". */
export async function renameDevice(id: string, name: string): Promise<void> {
  return DEMO ? demo.renameDevice(id, name) : real().renameDevice(id, name);
}

/**
 * Stores the contact address and the note of the access request on the server. The operator
 * approves the account and writes to this address; it is also used for maintenance and billing.
 */
export async function setContact(email: string, note: string): Promise<void> {
  return DEMO ? demo.setContact(email, note) : real().setContact(email, note);
}

/** Revokes another device; it keeps its local data but can no longer sync. */
export async function revokeDevice(id: string): Promise<void> {
  return DEMO ? demo.revokeDevice(id) : real().revokeDevice(id);
}

/**
 * Whether this device has own data (classes, students, lessons). A new device asks before the
 * first download replaces it.
 */
export async function hasLocalData(): Promise<boolean> {
  return DEMO ? demo.hasLocalData() : real().hasLocalData();
}

/**
 * Confirms that the account data replaces the local data and starts the first download.
 * Until then, a new device with local data does not download.
 */
export async function replaceLocalData(): Promise<void> {
  return DEMO ? demo.replaceLocalData() : real().replaceLocalData();
}

/** Hides the hint about an imported backup (`SyncStatus.importNotice`). */
export async function dismissImportNotice(): Promise<void> {
  return DEMO ? demo.dismissImportNotice() : real().dismissImportNotice();
}

/** Sends and receives changes now instead of waiting for the next trigger. */
export async function syncNow(): Promise<void> {
  return DEMO ? demo.syncNow() : real().syncNow();
}

/** Ends the session of this device. Local data and the data key stay. */
export async function logout(): Promise<void> {
  return DEMO ? demo.logout() : real().logout();
}

/** Deletes the account and all server data. Local data on this device stays. */
export async function deleteAccount(): Promise<void> {
  return DEMO ? demo.deleteAccount() : real().deleteAccount();
}
