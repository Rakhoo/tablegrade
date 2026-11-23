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
  missingKey: { label: "Schlüssel fehlt", tone: "warning" },
  expired: { label: "Abgemeldet", tone: "warning" },
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
