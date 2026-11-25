import type { SyncStatus } from "../sync/types";
import { getSyncBadge } from "./syncView";

/** How urgent a hint is: yellow needs a step, red means something failed. */
export type AttentionTone = "warning" | "error";

/** Settings tabs that can need attention. */
export type AttentionTab = "school" | "sync";

/** One thing the user should do in the settings. */
export type Attention = {
  /** Tab of the settings where it is done. */
  tab: AttentionTab;
  tone: AttentionTone;
  /** Short German label, e.g. "Noch kein Schuljahr eingerichtet". */
  label: string;
};

/** Inputs of `getAttention`, taken from the school years and the sync status. */
export type AttentionInput = {
  sync: SyncStatus;
  schoolYearCount: number;
};

/**
 * Open points of the setup, in the order of the settings tabs. Sync counts while it needs a
 * step or failed; being offline is no task for the user.
 */
export function getAttention({
  sync,
  schoolYearCount,
}: AttentionInput): Attention[] {
  const items: Attention[] = [];
  const badge = getSyncBadge(sync);
  if (
    badge &&
    badge.tone != "ok" &&
    badge.tone != "busy" &&
    sync.phase != "offline"
  )
    items.push({ tab: "sync", tone: badge.tone, label: badge.label });
  if (schoolYearCount == 0)
    items.push({
      tab: "school",
      tone: "warning",
      label: "Noch kein Schuljahr eingerichtet",
    });
  return items;
}

/** The most urgent tone of the items, `null` if there are none. */
export function worstTone(items: Attention[]): AttentionTone | null {
  if (items.some((item) => item.tone == "error")) return "error";
  return items.length ? "warning" : null;
}
