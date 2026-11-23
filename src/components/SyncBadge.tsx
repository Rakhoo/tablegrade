import { Link, useLocation } from "react-router";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { paths } from "../lib/paths";
import { rememberCurrentPageFor } from "../lib/returnPage";
import { getSyncBadge, type SyncBadgeTone } from "../lib/syncView";

/** Dot color per tone. */
const DOT_CLASSES: Record<SyncBadgeTone, string> = {
  ok: "bg-emerald-500",
  busy: "bg-brand-500 animate-pulse",
  warning: "bg-amber-500",
  error: "bg-red-600",
};

/**
 * Small sync state next to the speed dial on every page; nothing while sync is off. Leads to
 * the account and sync settings.
 */
export function SyncBadge() {
  const badge = getSyncBadge(useSyncStatus());
  const { pathname } = useLocation();
  if (!badge) return null;
  const to = paths.settings("sync");
  // Within the settings the way back must keep pointing to the page before them
  const inSettings = pathname == paths.settings();
  return (
    <Link
      to={to}
      aria-label={badge.label}
      onClick={() => {
        if (!inSettings) rememberCurrentPageFor(to);
      }}
      data-help="Stand der Synchronisierung: grün alles abgeglichen, gelb braucht Aufmerksamkeit, rot Fehler. Tippen öffnet die Einstellungen dazu."
      className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-surface text-sm font-medium text-ink shadow-card transition-transform active:scale-95 landscape:pr-4 landscape:pl-3"
    >
      <span className={`h-3 w-3 rounded-full ${DOT_CLASSES[badge.tone]}`} />
      <span className="portrait:hidden">{badge.label}</span>
    </Link>
  );
}
