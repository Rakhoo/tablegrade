import { Button, TextField } from "@mui/material";
import { useState, type FormEvent } from "react";
import { RECOVERY_KEY_USER_NAME } from "../../lib/recoveryKeyCheck";
import { unlockWithPasskey, unlockWithRecoveryKey } from "../../sync";
import { SyncDeviceLink } from "./SyncDeviceLink";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/**
 * Ways to get the data key onto a signed-in device: a passkey that can unlock, linking with
 * another device of the account, or the recovery key.
 */
export function SyncUnlock() {
  const { busy, error, run } = useSyncAction();
  return (
    <>
      <p className="text-sm">
        Die Daten sind verschlüsselt. Dieses Gerät braucht den Schlüssel. Dafür
        gibt es drei Wege:
      </p>
      <SyncErrorAlert error={error} />
      <div>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => run(unlockWithPasskey)}
          data-help="Entsperrt mit einem Passkey, der beim Einrichten dafür hinzugefügt wurde (Face ID, Touch ID oder Gerätecode)."
        >
          Mit Passkey entsperren
        </Button>
      </div>
      <SyncDeviceLink />
      <RecoveryKeyEntry />
    </>
  );
}

/**
 * Field for the recovery key. With the user name next to it, password managers offer to fill
 * in the saved key.
 */
function RecoveryKeyEntry() {
  const [text, setText] = useState("");
  const { busy, error, run } = useSyncAction();

  /** Unlocks with the typed key. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => unlockWithRecoveryKey(text));
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      {/* Hidden from view, but read by password managers to find the saved key */}
      <input
        type="text"
        value={RECOVERY_KEY_USER_NAME}
        autoComplete="username"
        readOnly
        hidden
      />
      <TextField
        size="small"
        label="Wiederherstellungsschlüssel"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="current-password"
        placeholder="XXXX-XXXX-…"
        slotProps={{
          htmlInput: {
            autoCapitalize: "characters",
            spellCheck: false,
            className: "font-mono",
          },
        }}
        data-help="Der Wiederherstellungsschlüssel aus Passwortmanager, Ausdruck oder Datei. Einfügen ist erlaubt, Groß- und Kleinschreibung egal."
      />
      <SyncErrorAlert error={error} />
      <div>
        <Button
          type="submit"
          variant="outlined"
          disabled={busy || !text.trim()}
          data-help="Entsperrt dieses Gerät mit dem eingegebenen Wiederherstellungsschlüssel."
        >
          Mit Schlüssel entsperren
        </Button>
      </div>
    </form>
  );
}
