import { Alert, Button } from "@mui/material";
import { PlusIcon } from "../../components/icons";
import { addPasskey, type AccountInfo } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

type SyncPasskeysProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/**
 * Passkeys that unlock the data on new devices. Kept apart from the sign-in: a passkey is
 * added only while signed in and unlocked, and it never creates an account.
 */
export function SyncPasskeys({ account }: SyncPasskeysProps) {
  const { busy, error, run } = useSyncAction();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Passkeys zum Entsperren</h3>
      {account.hasPrfPasskey ? (
        <p
          className="text-sm"
          data-help="Ein Passkey ersetzt auf einem neuen Gerät den Wiederherstellungsschlüssel und das Koppeln."
        >
          Eingerichtet. Neue Geräte lassen sich nach der Anmeldung mit Face ID,
          Touch ID oder Gerätecode entsperren.
        </p>
      ) : (
        <Alert
          severity="info"
          data-help="Mit einem Passkey lässt sich ein neues Gerät ohne Wiederherstellungsschlüssel und ohne altes Gerät entsperren."
        >
          Tipp: Passkey hinzufügen. Neue Geräte lassen sich dann nach der
          Anmeldung mit Face ID, Touch ID oder Gerätecode entsperren.
        </Alert>
      )}
      <SyncErrorAlert error={error} />
      <div>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PlusIcon size={16} />}
          disabled={busy}
          onClick={() => run(addPasskey)}
          data-help="Legt einen Passkey an, z. B. im iCloud-Schlüsselbund oder im Google Passwortmanager. Er entsperrt neue Geräte; anmelden geht weiter mit Microsoft oder Google."
        >
          {account.hasPrfPasskey
            ? "Weiteren Passkey hinzufügen"
            : "Passkey hinzufügen"}
        </Button>
      </div>
    </div>
  );
}
