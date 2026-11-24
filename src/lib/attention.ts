import { differenceInDays, parseISO } from "date-fns";
import type { SyncStatus } from "../sync/types";
import { getSyncBadge } from "./syncView";

/** How urgent a hint is: yellow needs a step, red means something failed. */
export type AttentionTone = "warning" | "error";

/** Settings tabs that can need attention. */
export type AttentionTab = "school" | "data" | "sync";

/** One thing the user should do in the settings. */
export type Attention = {
  /** Tab of the settings where it is done. */
  tab: AttentionTab;
  tone: AttentionTone;
  /** Short German label, e.g. "Noch keine Sicherung". */
  label: string;
};

/** Whether the backup reminder is due: never backed up or longer ago than set; 0 turns it off. */
export function isBackupDue(
  reminderDays: number,
  lastBackup: string | null,
  now = new Date(),
): boolean {
  if (reminderDays <= 0) return false;
  return (
    !lastBackup || differenceInDays(now, parseISO(lastBackup)) >= reminderDays
  );
}

/** Inputs of `getAttention`, taken from the settings, the school years and the sync status. */
export type AttentionInput = {
  sync: SyncStatus;
  backupReminderDays: number;
  lastBackup: string | null;
  schoolYearCount: number;
  now?: Date;
};

/**
 * Open points of the setup, in the order of the settings tabs. Sync counts while it needs a
 * step or failed; being offline is no task for the user.
 */
export function getAttention({
  sync,
  backupReminderDays,
  lastBackup,
  schoolYearCount,
  now,
}: AttentionInput): Attention[] {
  const items: Attention[] = [];
  if (schoolYearCount == 0)
    items.push({
      tab: "school",
      tone: "warning",
      label: "Noch kein Schuljahr eingerichtet",
    });
  if (isBackupDue(backupReminderDays, lastBackup, now))
    items.push({
      tab: "data",
      tone: "warning",
      label: lastBackup ? "Sicherung fällig" : "Noch keine Sicherung",
    });
  const badge = getSyncBadge(sync);
  if (
    badge &&
    badge.tone != "ok" &&
    badge.tone != "busy" &&
    sync.phase != "offline"
  )
    items.push({ tab: "sync", tone: badge.tone, label: badge.label });
  return items;
}

/** The most urgent tone of the items, `null` if there are none. */
export function worstTone(items: Attention[]): AttentionTone | null {
  if (items.some((item) => item.tone == "error")) return "error";
  return items.length ? "warning" : null;
}
