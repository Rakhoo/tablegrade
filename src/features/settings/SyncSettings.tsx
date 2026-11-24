import { Alert, Button, LinearProgress } from "@mui/material";
import { format } from "date-fns";
import { useState, type ReactNode } from "react";
import { RefreshIcon } from "../../components/icons";
import { SyncImportNotice } from "../../components/SyncImportNotice";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { disableSync, syncNow, type SyncStatus } from "../../sync";
import { getSyncView, type SyncView } from "../../lib/syncView";
import { reloadApp } from "../../services/pwa";
import { SettingsSection } from "./SettingsSection";
import { SyncAccountActions } from "./SyncAccountActions";
import { SyncApproveLink } from "./SyncApproveLink";
import { SyncDevices } from "./SyncDevices";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncIdentities } from "./SyncIdentities";
import { SyncPasskeys } from "./SyncPasskeys";
import { SyncIntro } from "./SyncIntro";
import { SyncRecoveryKey } from "./SyncRecoveryKey";
import { SyncReplaceCheck } from "./SyncReplaceCheck";
import { SyncSignIn } from "./SyncSignIn";
import { useSyncAction } from "./useSyncAction";

/** Short line under the card title for each view. */
const HINTS: Record<SyncView, string> = {
  off: "Aus. Alle Daten liegen nur auf diesem Gerät.",
  setup:
    "Einrichtung: mit Google oder Microsoft anmelden. Beim ersten Mal entsteht das Konto.",
  createKey: "Neues Konto: Wiederherstellungsschlüssel sichern.",
  missingKey:
    "Angemeldet. Dieses Gerät braucht noch den Schlüssel zu den Daten.",
  active: "Aktiv. Die Daten werden verschlüsselt abgeglichen.",
  expired: "Abgemeldet oder Anmeldung abgelaufen.",
  upgrade: "Pausiert. Diese App-Version ist zu alt.",
};

/**
 * Account and sync settings. Shows the step that fits the sync status: the explanation while
 * it is off, the setup, the key of a new account, unlocking a new device, the active sync, an
 * expired sign-in and a needed update.
 */
export function SyncSettings() {
  const status = useSyncStatus();
  const view = getSyncView(status);
  // Creating the key ends the "createKey" view at once; keep the key on screen until it is checked
  const [keySetup, setKeySetup] = useState(false);
  if (view == "createKey" && !keySetup) setKeySetup(true);

  const content: Record<SyncView, ReactNode> = {
    off: <SyncIntro />,
    setup: (
      <>
        <SyncSignIn />
        <CancelSetup />
      </>
    ),
    createKey: null,
    missingKey: <SyncReplaceCheck />,
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
      hint={HINTS[keySetup ? "createKey" : view]}
      help="Konto für den verschlüsselten Abgleich der Daten zwischen eigenen Geräten: einrichten, Gerät hinzufügen, Status."
    >
      {status.importNotice && <SyncImportNotice />}
      {keySetup ? (
        <SyncRecoveryKey
          intro="Das Konto ist angelegt. Jetzt den Wiederherstellungsschlüssel erstellen und sicher aufbewahren."
          onDone={() => setKeySetup(false)}
        />
      ) : (
        content[view]
      )}
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
        </>
      )}
      <SyncApproveLink />
      <SyncDevices />
      <SyncAccountActions />
    </>
  );
}
