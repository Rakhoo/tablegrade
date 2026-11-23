import { Alert, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { disableSync, hasLocalData, replaceLocalData } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncUnlock } from "./SyncUnlock";
import { useSyncAction } from "./useSyncAction";

/**
 * Asks before the first download whether school data already on this device may be replaced
 * by the data of the account; merging both is not possible. Then shows the ways to unlock.
 */
export function SyncReplaceCheck() {
  // null while the check runs
  const [localData, setLocalData] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useSyncAction();
  const { revalidate } = useRevalidator();

  useEffect(() => {
    let active = true;
    hasLocalData().then(
      (found) => active && setLocalData(found),
      // Unknown: ask anyway, losing data by mistake is worse than one question
      () => active && setLocalData(true),
    );
    return () => {
      active = false;
    };
  }, []);

  /** Deletes the local school data, so the download fills the device. */
  const replace = () =>
    run(async () => {
      await replaceLocalData();
      await revalidate();
      setLocalData(false);
    });

  if (localData == null) return null;
  if (!localData) return <SyncUnlock />;
  return (
    <>
      <Alert severity="warning">
        Auf diesem Gerät sind schon eigene Daten. Beim Synchronisieren werden
        sie durch die Daten des Kontos ersetzt. Zusammenführen geht nicht.
      </Alert>
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="contained"
          color="error"
          disabled={busy}
          onClick={() => setConfirming(true)}
          data-help="Löscht die Daten auf diesem Gerät und holt danach die Daten des Kontos."
        >
          Daten ersetzen
        </Button>
        <Button
          disabled={busy}
          onClick={() => run(disableSync)}
          data-help="Schaltet die Synchronisierung aus. Die Daten auf diesem Gerät bleiben unverändert."
        >
          Abbrechen
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Daten auf diesem Gerät ersetzen?"
        confirmLabel="Ersetzen"
        onConfirm={() => void replace()}
        onClose={() => setConfirming(false)}
      >
        Klassen, Schüler und Einträge auf diesem Gerät werden gelöscht. Eine
        Sicherung vorher ist möglich (Einstellungen, Daten und Export).
      </ConfirmDialog>
    </>
  );
}
