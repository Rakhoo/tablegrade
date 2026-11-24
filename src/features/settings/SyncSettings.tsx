import { Alert, Button, LinearProgress } from "@mui/material";
import { format } from "date-fns";
import { useState, type ReactNode } from "react";
import { RefreshIcon } from "../../components/icons";
import { SyncImportNotice } from "../../components/SyncImportNotice";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { syncNow, type SyncStatus } from "../../sync";
import { getSyncView, type SyncView } from "../../lib/syncView";
import { reloadApp } from "../../services/pwa";
import { SettingsSection } from "./SettingsSection";
import { SyncAccountActions } from "./SyncAccountActions";
import { SyncApproveLink } from "./SyncApproveLink";
import { SyncContact } from "./SyncContact";
import { SyncDevices } from "./SyncDevices";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncIdentities } from "./SyncIdentities";
import { SyncIntro } from "./SyncIntro";
import { SyncPasskeys } from "./SyncPasskeys";
import { SyncSetupWizard, type SetupView } from "./SyncSetupWizard";
import { SyncSignIn } from "./SyncSignIn";
import { useSyncAction } from "./useSyncAction";

/** Short line under the card title for each view. */
const HINTS: Record<SyncView, string> = {
  off: "Aus. Alle Daten liegen nur auf diesem Gerät.",
  setup: "Einrichtung: Schritt für Schritt bis zur Synchronisierung.",
  pending: "Einrichtung: Das Konto wartet auf Freischaltung.",
  createKey: "Einrichtung: Wiederherstellungsschlüssel sichern.",
  missingKey: "Einrichtung: Dieses Gerät braucht den Schlüssel zu den Daten.",
  replace: "Einrichtung: Vor dem ersten Abgleich zustimmen.",
  active: "Aktiv. Die Daten werden verschlüsselt abgeglichen.",
  expired: "Abgemeldet oder Anmeldung abgelaufen.",
  upgrade: "Pausiert. Diese App-Version ist zu alt.",
};

/** Views handled by the setup wizard instead of a view of their own. */
const SETUP_VIEWS: readonly SyncView[] = [
  "setup",
  "pending",
  "createKey",
  "missingKey",
  "replace",
];

/** Whether the view is a step of the setup. */
const isSetupView = (view: SyncView): view is SetupView =>
  SETUP_VIEWS.includes(view);

/**
 * Account and sync settings: the explanation while sync is off, the setup wizard until the
 * device syncs, then the active sync with its settings; also an expired sign-in and a needed
 * update.
 */
export function SyncSettings() {
  const status = useSyncStatus();
  const syncView = getSyncView(status);
  // Creating the key ends the "createKey" view at once; keep the key on screen until it is checked
  const [keySetup, setKeySetup] = useState(false);
  if (syncView == "createKey" && !keySetup) setKeySetup(true);
  const view = keySetup ? "createKey" : syncView;

  /** The views that are no setup step. */
  const content: Record<Exclude<SyncView, SetupView>, ReactNode> = {
    off: <SyncIntro />,
    active: <SyncActive status={status} />,
    expired: (
      <>
        <Alert severity="warning">
          Die App arbeitet auf diesem Gerät normal weiter. Neu anmelden, um
          wieder zu synchronisieren.
        </Alert>
        <SyncSignIn />
      </>
    ),
    upgrade: <SyncUpgrade />,
  };
  return (
    <SettingsSection
      title="Konto & Synchronisierung"
      hint={HINTS[view]}
      help="Konto für den verschlüsselten Abgleich der Daten zwischen eigenen Geräten: einrichten, Gerät hinzufügen, Status."
    >
      {status.importNotice && <SyncImportNotice />}
      {isSetupView(view) ? (
        <SyncSetupWizard view={view} onKeyDone={() => setKeySetup(false)} />
      ) : (
        content[view]
      )}
    </SettingsSection>
  );
}

/** Sync pauses until the app is updated; the app keeps working locally meanwhile. */
function SyncUpgrade() {
  return (
    <>
      <Alert severity="warning">
        Für den Abgleich braucht es eine neuere Version der App. Die App
        arbeitet auf diesem Gerät normal weiter.
      </Alert>
      <div>
        <Button
          variant="contained"
          startIcon={<RefreshIcon size={18} />}
          onClick={reloadApp}
          data-help="Lädt die App neu und holt dabei die neueste Version."
        >
          Neu laden
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
  const { phase, lastSyncAt, pending, progress } = status;
  return (
    <>
      {progress && (
        <div
          className="flex flex-col gap-1 text-sm"
          data-help="Erster Abgleich: Alle Daten werden einmal verschlüsselt übertragen. Die App ist dabei weiter benutzbar."
        >
          Erster Abgleich: {progress.done} von {progress.total} Einträgen
          <LinearProgress
            variant="determinate"
            value={(100 * progress.done) / Math.max(progress.total, 1)}
          />
        </div>
      )}
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
      {status.account && (
        <>
          <SyncIdentities account={status.account} />
          <SyncPasskeys account={status.account} />
          <SyncContact account={status.account} />
        </>
      )}
      <SyncApproveLink />
      <SyncDevices />
      <SyncAccountActions />
    </>
  );
}
