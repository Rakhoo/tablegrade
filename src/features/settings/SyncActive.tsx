import { Button, LinearProgress } from "@mui/material";
import { format } from "date-fns";
import { RefreshIcon } from "../../components/icons";
import { getSyncBadge, type SyncBadgeTone } from "../../lib/syncView";
import { syncNow, type SyncStatus } from "../../sync";
import { SyncAccountActions } from "./SyncAccountActions";
import { SyncApproveLink } from "./SyncApproveLink";
import { SyncBlock } from "./SyncBlock";
import { SyncContact } from "./SyncContact";
import { SyncDevices } from "./SyncDevices";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncNewRecoveryKey } from "./SyncNewRecoveryKey";
import { SyncPasskeys } from "./SyncPasskeys";
import { SyncSignedIn } from "./SyncSignedIn";
import { useSyncAction } from "./useSyncAction";

/** Texts for the phases of an active sync. */
const PHASE_TEXTS: Partial<Record<SyncStatus["phase"], string>> = {
  idle: "Alles abgeglichen",
  syncing: "Abgleich läuft …",
  offline: "Offline, Änderungen warten",
  error: "Fehler beim Abgleich",
};

/** Dot color of the state per tone. */
const STATE_DOTS: Record<SyncBadgeTone, string> = {
  ok: "bg-emerald-500",
  busy: "bg-brand-500 animate-pulse",
  warning: "bg-amber-500",
  error: "bg-red-600",
};

type SyncActiveProps = {
  /** Current sync status. */
  status: SyncStatus;
};

/**
 * The running sync: its state with "Jetzt synchronisieren" on top, then the blocks account,
 * devices, unlocking and ending the sync.
 */
export function SyncActive({ status }: SyncActiveProps) {
  const { account } = status;
  return (
    <>
      <SyncState status={status} />
      {account && (
        <SyncBlock
          title="Konto"
          help="Anmeldeweg und Kontakt-Adresse des Kontos."
        >
          <SyncSignedIn account={account} />
          <SyncContact account={account} />
        </SyncBlock>
      )}
      <SyncBlock
        title="Geräte"
        help="Geräte des Kontos anzeigen, umbenennen, sperren und ein neues Gerät koppeln."
      >
        <SyncDevices />
        <SyncApproveLink />
      </SyncBlock>
      {account && (
        <SyncBlock
          title="Entsperren & Wiederherstellung"
          help="Wege, mit denen ein neues Gerät an den Schlüssel der Daten kommt."
        >
          <SyncPasskeys account={account} />
          <SyncNewRecoveryKey />
        </SyncBlock>
      )}
      <SyncBlock
        title="Abmelden & Löschen"
        help="Beendet den Abgleich auf diesem Gerät oder löscht das Konto."
      >
        <SyncAccountActions />
      </SyncBlock>
    </>
  );
}

/** State of the sync with a colored dot, the last sync time and a button to sync now. */
function SyncState({ status }: SyncActiveProps) {
  const { busy, error, run } = useSyncAction();
  const { phase, lastSyncAt, pending, progress } = status;
  const tone = getSyncBadge(status)?.tone ?? "ok";
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm"
          data-help="Stand des Abgleichs auf diesem Gerät: grün abgeglichen, blau läuft, gelb wartet, rot Fehler."
        >
          <span
            className={`h-3 w-3 shrink-0 rounded-full ${STATE_DOTS[tone]}`}
          />
          <span>
            <span className="font-medium">{PHASE_TEXTS[phase]}</span>
            {lastSyncAt != null &&
              ` · zuletzt ${format(lastSyncAt, "dd.MM.yyyy, HH:mm")}`}
            {pending > 0 && ` · ${pending} Änderungen offen`}
          </span>
        </div>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon size={16} />}
          disabled={busy || phase == "syncing"}
          onClick={() => run(syncNow)}
          data-help="Sendet und holt Änderungen sofort, statt auf den nächsten Abgleich zu warten."
        >
          Jetzt synchronisieren
        </Button>
      </div>
      {progress && (
        <div
          className="flex flex-col gap-1 text-sm"
          data-help="Erster Abgleich: Alle Daten werden einmal verschlüsselt übertragen. Die App ist dabei weiter benutzbar."
        >
          Erster Abgleich: {progress.done} von {progress.total}{" "}
          {progress.unit == "photos" ? "Fotos" : "Einträgen"}
          <LinearProgress
            variant="determinate"
            value={(100 * progress.done) / Math.max(progress.total, 1)}
          />
        </div>
      )}
      <SyncErrorAlert error={error ?? status.error} />
    </div>
  );
}
