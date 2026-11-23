/**
 * Public facade of account, encryption and sync (docs/sync-plan). The UI uses only this
 * module. Until the engine exists (Stream B), the functions throw, or return sample values
 * when built with `VITE_SYNC_DEMO=true`.
 */
import { demo } from "./demo";
import { addStatusListener, readStatus } from "./status";
import type {
  Device,
  DeviceLinkApproval,
  OidcProvider,
  PendingDeviceLink,
  SignInResult,
} from "./types";

export type * from "./types";

/** Build-time switch; Vite inlines it, so the demo is dropped from normal builds. */
const DEMO = import.meta.env.VITE_SYNC_DEMO === "true";

/** Placeholder for parts that Stream B implements. */
function notImplemented(): never {
  throw new Error("not implemented");
}

/** Current sync status snapshot. */
export const getSyncStatus = readStatus;

/** Calls `listener` on every status change; returns the function to unsubscribe. */
export const subscribeSyncStatus = addStatusListener;

/** Turns sync on for this device. The status becomes `signedOut` until a sign-in. */
export async function enableSync(): Promise<void> {
  return DEMO ? demo.enableSync() : notImplemented();
}

/** Turns sync off. Local data stays; the session on the server ends. */
export async function disableSync(): Promise<void> {
  return DEMO ? demo.disableSync() : notImplemented();
}

/** Creates a new account with a passkey on this device. */
export async function startPasskeySignup(
  deviceName: string,
): Promise<SignInResult> {
  return DEMO ? demo.startPasskeySignup(deviceName) : notImplemented();
}

/** Signs in with an existing passkey (discoverable credential). */
export async function loginWithPasskey(
  deviceName: string,
): Promise<SignInResult> {
  return DEMO ? demo.loginWithPasskey(deviceName) : notImplemented();
}

/**
 * Starts the OIDC login with Microsoft or Google. Navigates away; the app finishes the login
 * when it opens again with `?oidc=callback`.
 */
export async function startOidcLogin(
  provider: OidcProvider,
  deviceName: string,
): Promise<void> {
  return DEMO ? demo.startOidcLogin(provider, deviceName) : notImplemented();
}

/**
 * Links a Microsoft or Google account to the signed-in account. Navigates away like
 * `startOidcLogin`; the return links the identity instead of signing in.
 */
export async function linkOidcIdentity(provider: OidcProvider): Promise<void> {
  return DEMO ? demo.linkOidcIdentity(provider) : notImplemented();
}

/** Adds a passkey on this device and wraps the data key for it when it supports PRF. */
export async function addPasskey(): Promise<void> {
  return DEMO ? demo.addPasskey() : notImplemented();
}

/** Unlocks the data key with a passkey that supports PRF. */
export async function unlockWithPasskey(): Promise<void> {
  return DEMO ? demo.unlockWithPasskey() : notImplemented();
}

/**
 * Unlocks the data key with the recovery key as typed by the user (any case, with or without
 * dashes). Throws with a German message on typos or a wrong key.
 */
export async function unlockWithRecoveryKey(text: string): Promise<void> {
  return DEMO ? demo.unlockWithRecoveryKey(text) : notImplemented();
}

/**
 * Creates a new recovery key and replaces the old one on the server. Returns the text to show
 * once, e.g. `K7QF-M2XA-…`. For a new account this also creates the data key.
 */
export async function createRecoveryKey(): Promise<string> {
  return DEMO ? demo.createRecoveryKey() : notImplemented();
}

/** Starts linking on the new device (signed in, but locked). */
export async function startDeviceLink(): Promise<PendingDeviceLink> {
  return DEMO ? demo.startDeviceLink() : notImplemented();
}

/** Looks up a link code on the old device (unlocked). */
export async function confirmDeviceLink(
  code: string,
): Promise<DeviceLinkApproval> {
  return DEMO ? demo.confirmDeviceLink(code) : notImplemented();
}

/** Lists all devices of the account, including revoked ones. */
export async function listDevices(): Promise<Device[]> {
  return DEMO ? demo.listDevices() : notImplemented();
}

/** Renames a device of the account, e.g. "iPad Schule". */
export async function renameDevice(id: string, name: string): Promise<void> {
  return DEMO ? demo.renameDevice(id, name) : notImplemented();
}

/** Revokes another device; it keeps its local data but can no longer sync. */
export async function revokeDevice(id: string): Promise<void> {
  return DEMO ? demo.revokeDevice(id) : notImplemented();
}

/**
 * Whether this device has own data (classes, students, lessons). A new device asks before the
 * first download replaces it.
 */
export async function hasLocalData(): Promise<boolean> {
  return DEMO ? demo.hasLocalData() : notImplemented();
}

/**
 * Confirms that the account data replaces the local data and starts the first download.
 * Until then, a new device with local data does not download.
 */
export async function replaceLocalData(): Promise<void> {
  return DEMO ? demo.replaceLocalData() : notImplemented();
}

/** Sends and receives changes now instead of waiting for the next trigger. */
export async function syncNow(): Promise<void> {
  return DEMO ? demo.syncNow() : notImplemented();
}

/** Ends the session of this device. Local data and the data key stay. */
export async function logout(): Promise<void> {
  return DEMO ? demo.logout() : notImplemented();
}

/** Deletes the account and all server data. Local data on this device stays. */
export async function deleteAccount(): Promise<void> {
  return DEMO ? demo.deleteAccount() : notImplemented();
}
