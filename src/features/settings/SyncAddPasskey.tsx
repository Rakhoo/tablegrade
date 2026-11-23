import { Alert, Button } from "@mui/material";
import { PlusIcon } from "../../components/icons";
import { addPasskey, type AccountInfo } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

type SyncAddPasskeyProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/**
 * Offers a passkey that unlocks new devices, as long as the account has none. Without it a
 * new device needs the old one or the recovery key.
 */
export function SyncAddPasskey({ account }: SyncAddPasskeyProps) {
  const { busy, error, run } = useSyncAction();
  if (account.hasPrfPasskey) return null;
  return (
    <>
      <Alert
        severity="info"
        data-help="Mit einem Passkey lässt sich ein neues Gerät ohne Wiederherstellungsschlüssel und ohne altes Gerät entsperren."
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<PlusIcon size={16} />}
            disabled={busy}
            onClick={() => run(addPasskey)}
          >
            Passkey hinzufügen
          </Button>
        }
      >
        Tipp: Passkey zum Entsperren hinzufügen. Neue Geräte lassen sich dann
        mit Face ID oder Touch ID entsperren.
      </Alert>
      <SyncErrorAlert error={error} />
    </>
  );
}
