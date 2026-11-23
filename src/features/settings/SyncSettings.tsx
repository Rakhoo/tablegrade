import { Alert, Button } from "@mui/material";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { RefreshIcon } from "../../components/icons";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { disableSync, syncNow, type SyncStatus } from "../../sync";
import { getSyncView, type SyncView } from "../../lib/syncView";
import { SettingsSection } from "./SettingsSection";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncIntro } from "./SyncIntro";
import { useSyncAction } from "./useSyncAction";

/** Short line under the card title for each view. */
const HINTS: Record<SyncView, string> = {
  off: "Aus. Alle Daten liegen nur auf diesem Gerät.",
  setup: "Einrichtung: Anmeldeweg wählen.",
  missingKey:
    "Angemeldet. Dieses Gerät braucht noch den Schlüssel zu den Daten.",
  active: "Aktiv. Die Daten werden verschlüsselt abgeglichen.",
  expired: "Anmeldung abgelaufen.",
};

/**
 * Account and sync settings. Shows the step that fits the sync status: the explanation while
 * it is off, the setup, unlocking a new device, the active sync and an expired sign-in.
 */
export function SyncSettings() {
  const status = useSyncStatus();
  const view = getSyncView(status);
  const content: Record<SyncView, ReactNode> = {
    off: <SyncIntro />,
    setup: <CancelSetup />,
    missingKey: null,
    active: <SyncActive status={status} />,
    expired: (
      <Alert severity="warning">
        Die App arbeitet auf diesem Gerät normal weiter. Neu anmelden, um wieder
        zu synchronisieren.
      </Alert>
    ),
  };
  return (
    <SettingsSection
      title="Konto & Synchronisierung"
      hint={HINTS[view]}
      help="Konto für den verschlüsselten Abgleich der Daten zwischen eigenen Geräten: einrichten, Gerät hinzufügen, Status."
    >
      {content[view]}
    </SettingsSection>
  );
}

/** Ends an unfinished setup; sync is then off again. */
function CancelSetup() {
  const { busy, error, run } = useSyncAction();
  return (
    <>
      <SyncErrorAlert error={error} />
      <div>
        <Button
          disabled={busy}
          onClick={() => run(disableSync)}
          data-help="Bricht die Einrichtung ab; die Daten bleiben nur auf diesem Gerät."
        >
          Einrichtung abbrechen
        </Button>
      </div>
    </>
  );
}

type SyncActiveProps = {
  /** Current sync status. */
  status: SyncStatus;
};

/** Texts for the phases of an active sync. */
const PHASE_TEXTS: Partial<Record<SyncStatus["phase"], string>> = {
  idle: "Alles abgeglichen",
  syncing: "Abgleich läuft …",
  offline: "Offline, Änderungen warten",
  error: "Fehler beim Abgleich",
};

/** State of the active sync with the last sync time and a button to sync now. */
function SyncActive({ status }: SyncActiveProps) {
  const { busy, error, run } = useSyncAction();
  const { phase, lastSyncAt, pending } = status;
  return (
    <>
      <p className="text-sm" data-help="Stand des Abgleichs auf diesem Gerät.">
        {PHASE_TEXTS[phase]}
        {lastSyncAt != null &&
          ` · zuletzt am ${format(lastSyncAt, "dd.MM.yyyy 'um' HH:mm")}`}
        {pending > 0 && ` · ${pending} Änderungen offen`}
      </p>
      <SyncErrorAlert error={error ?? status.error} />
      <div>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon size={18} />}
          disabled={busy || phase == "syncing"}
          onClick={() => run(syncNow)}
          data-help="Sendet und holt Änderungen sofort, statt auf den nächsten Abgleich zu warten."
        >
          Jetzt synchronisieren
        </Button>
      </div>
    </>
  );
}
