import type { SyncStatus } from "../sync/types";

/**
 * What the account and sync settings show:
 * - `off`: sync is disabled.
 * - `setup`: sync is enabled, but this device was never signed in.
 * - `missingKey`: signed in, but the device has no data key yet.
 * - `active`: signed in and unlocked (syncing, idle, offline or failed).
 * - `expired`: the sign-in ended after the device had synced; the app keeps working locally.
 */
export type SyncView = "off" | "setup" | "missingKey" | "active" | "expired";

/**
 * Maps the sync status to the view of the settings. A signed-out device that synced before
 * lost its sign-in (revoked or expired) instead of being set up for the first time.
 */
export function getSyncView({ phase, lastSyncAt }: SyncStatus): SyncView {
  switch (phase) {
    case "off":
      return "off";
    case "signedOut":
      return lastSyncAt == null ? "setup" : "expired";
    case "locked":
      return "missingKey";
    default:
      return "active";
  }
}
