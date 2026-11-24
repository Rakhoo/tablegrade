import type { OidcProvider, SyncStatus } from "../sync/types";

/** Display names of the sign-in providers. */
export const PROVIDER_LABELS: Record<OidcProvider, string> = {
  microsoft: "Microsoft",
  google: "Google",
};

/**
 * What the account and sync settings show:
 * - `off`: sync is disabled.
 * - `setup`: sync is enabled, but this device was never signed in.
 * - `createKey`: signed in to a new account that has no data key yet.
 * - `missingKey`: signed in, but the device has no data key yet.
 * - `active`: signed in and unlocked (syncing, idle, offline or failed).
 * - `expired`: the sign-in ended after the device had synced; the app keeps working locally.
 * - `upgrade`: the server or the synced data needs a newer app version.
 * - `pending`: signed in, but the operator has not approved the account yet.
 * - `replace`: unlocked, but own local data would be replaced by the account's data.
 */
export type SyncView =
  | "off"
  | "setup"
  | "createKey"
  | "missingKey"
  | "active"
  | "expired"
  | "upgrade"
  | "pending"
  | "replace";

/**
 * Maps the sync status to the view of the settings. A signed-out device that synced before
 * lost its sign-in (revoked or expired) instead of being set up for the first time. A locked
 * account without a data key is new and creates the key instead of unlocking it.
 */
export function getSyncView({
  phase,
  lastSyncAt,
  account,
}: SyncStatus): SyncView {
  switch (phase) {
    case "off":
      return "off";
    case "signedOut":
      return lastSyncAt == null ? "setup" : "expired";
    case "locked":
      return account?.hasDataKey == false ? "createKey" : "missingKey";
    case "upgradeRequired":
      return "upgrade";
    case "notApproved":
      return "pending";
    case "setupIncomplete":
      return account?.hasRecoveryKey ? "replace" : "createKey";
    default:
      return "active";
  }
}

/** How the sync badge looks: fine, working, needs attention, failed. */
export type SyncBadgeTone = "ok" | "busy" | "warning" | "error";

/** Short state of the sync for the badge next to the speed dial. */
export type SyncBadge = {
  /** German label, e.g. "Synchronisiert". */
  label: string;
  /** Color of the badge. */
  tone: SyncBadgeTone;
};

/** Badges of the views that are not an active sync. */
const VIEW_BADGES: Record<Exclude<SyncView, "off" | "active">, SyncBadge> = {
  setup: { label: "Einrichtung offen", tone: "warning" },
  createKey: { label: "Einrichtung offen", tone: "warning" },
  missingKey: { label: "Schlüssel fehlt", tone: "warning" },
  expired: { label: "Abgemeldet", tone: "warning" },
  upgrade: { label: "Update nötig", tone: "error" },
  pending: { label: "Freischaltung offen", tone: "warning" },
  replace: { label: "Einrichtung offen", tone: "warning" },
};

/** Badges of the phases of an active sync. */
const PHASE_BADGES: Partial<Record<SyncStatus["phase"], SyncBadge>> = {
  idle: { label: "Synchronisiert", tone: "ok" },
  syncing: { label: "Synchronisiert …", tone: "busy" },
  offline: { label: "Offline", tone: "warning" },
  error: { label: "Sync-Fehler", tone: "error" },
};

/** The badge for the sync status; `null` while sync is off, so nothing shows. */
export function getSyncBadge(status: SyncStatus): SyncBadge | null {
  const view = getSyncView(status);
  if (view == "off") return null;
  if (view != "active") return VIEW_BADGES[view];
  return PHASE_BADGES[status.phase] ?? null;
}
