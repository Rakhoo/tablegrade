import { Button, Checkbox, FormControlLabel, TextField } from "@mui/material";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { deleteSchoolData } from "../../db";
import { deleteAccount, disableSync, logout } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/** Word to type before the account is deleted, so it does not happen by a slip. */
const DELETE_WORD = "LÖSCHEN";

/** Account steps that end or change the sync, each behind a confirmation. */
type Confirmable = "disable" | "logout" | "delete";

/**
 * Ending the sync on this device or for the account: signing out, turning sync off and
 * deleting the account, each behind a confirmation.
 */
export function SyncAccountActions() {
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const [typedWord, setTypedWord] = useState("");
  const [deleteLocal, setDeleteLocal] = useState(false);
  const { busy, error, run } = useSyncAction();
  const { revalidate } = useRevalidator();

  /** Closes the dialog and forgets what was typed in it. */
  const close = () => {
    setConfirming(null);
    setTypedWord("");
    setDeleteLocal(false);
  };

  /** Deletes the account and, if chosen, the school data on this device. */
  const removeAccount = (withLocalData: boolean) =>
    run(async () => {
      await deleteAccount();
      if (!withLocalData) return;
      await deleteSchoolData();
      await revalidate();
    });

  return (
    <>
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          disabled={busy}
          onClick={() => setConfirming("logout")}
          data-help="Meldet dieses Gerät ab. Die Daten bleiben auf dem Gerät; zum Abgleich neu anmelden."
        >
          Abmelden
        </Button>
        <Button
          size="small"
          disabled={busy}
          onClick={() => setConfirming("disable")}
          data-help="Schaltet die Synchronisierung auf diesem Gerät aus. Die Daten bleiben auf dem Gerät."
        >
          Synchronisierung ausschalten
        </Button>
        <Button
          size="small"
          color="error"
          disabled={busy}
          onClick={() => setConfirming("delete")}
          data-help="Löscht das Konto und alle Daten auf dem Server. Wahlweise auch die Daten auf diesem Gerät."
        >
          Konto löschen
        </Button>
      </div>
      <ConfirmDialog
        open={confirming == "logout"}
        title="Dieses Gerät abmelden?"
        confirmLabel="Abmelden"
        confirmColor="primary"
        onConfirm={() => run(logout)}
        onClose={close}
      >
        Die Daten bleiben auf dem Gerät. Änderungen werden erst nach einer neuen
        Anmeldung wieder abgeglichen.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming == "disable"}
        title="Synchronisierung ausschalten?"
        confirmLabel="Ausschalten"
        confirmColor="primary"
        onConfirm={() => run(disableSync)}
        onClose={close}
      >
        Die Daten bleiben auf diesem Gerät und im Konto. Andere Geräte
        synchronisieren weiter.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming == "delete"}
        title="Konto löschen?"
        confirmDisabled={typedWord.trim().toUpperCase() != DELETE_WORD}
        onConfirm={() => removeAccount(deleteLocal)}
        onClose={close}
      >
        <div className="flex flex-col gap-3">
          <p>
            Das Konto und alle Daten auf dem Server werden gelöscht. Andere
            Geräte können nicht mehr synchronisieren. Das lässt sich nicht
            rückgängig machen.
          </p>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteLocal}
                onChange={(event) => setDeleteLocal(event.target.checked)}
              />
            }
            label="Auch die Klassen, Schüler und Noten auf diesem Gerät löschen"
          />
          <TextField
            size="small"
            label={`Zum Bestätigen „${DELETE_WORD}“ eingeben`}
            value={typedWord}
            onChange={(event) => setTypedWord(event.target.value)}
            autoComplete="off"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
