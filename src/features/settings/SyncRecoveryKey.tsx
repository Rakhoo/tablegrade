import { Alert, Button, TextField } from "@mui/material";
import { useState, type FormEvent } from "react";
import { createRecoveryKey } from "../../sync";
import {
  copyRecoveryKey,
  printRecoveryKey,
  saveRecoveryKey,
} from "../../services/recoveryKeyExport";
import { RECOVERY_KEY_USER_NAME } from "../../lib/recoveryKeyCheck";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { SyncRecoveryKeyCheck } from "./SyncRecoveryKeyCheck";
import { useSyncAction } from "./useSyncAction";

type SyncRecoveryKeyProps = {
  /** Line above the button that creates the key, e.g. why a key is needed now. */
  intro: string;
  /** Called after the user typed back the check groups. */
  onDone: () => void;
};

/**
 * Creates a recovery key, shows it once with ways to keep it, and asks for two groups of it
 * to make sure it was saved. Used for a new account and to replace the key later.
 */
export function SyncRecoveryKey({ intro, onDone }: SyncRecoveryKeyProps) {
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { busy, error, run } = useSyncAction();

  /** Creates the key on the server and shows it. */
  const create = async () => {
    const created = await run(createRecoveryKey);
    if (created) setRecoveryKey(created);
  };

  if (!recoveryKey)
    return (
      <>
        <p className="text-sm">{intro}</p>
        <SyncErrorAlert error={error} />
        <div>
          <Button
            variant="contained"
            disabled={busy}
            onClick={create}
            data-help="Erstellt den Wiederherstellungsschlüssel. Er wird nur einmal angezeigt."
          >
            Schlüssel erstellen
          </Button>
        </div>
      </>
    );
  if (checking)
    return (
      <SyncRecoveryKeyCheck
        recoveryKey={recoveryKey}
        onBack={() => setChecking(false)}
        onDone={onDone}
      />
    );
  return (
    <RecoveryKeyDisplay
      recoveryKey={recoveryKey}
      onNext={() => setChecking(true)}
    />
  );
}

type RecoveryKeyDisplayProps = {
  /** The formatted recovery key. */
  recoveryKey: string;
  /** Goes on to the check once the key is kept. */
  onNext: () => void;
};

/**
 * The recovery key in a form that password managers offer to save (user name plus a field
 * marked as new password), with buttons to copy, print and save it as a file.
 */
function RecoveryKeyDisplay({ recoveryKey, onNext }: RecoveryKeyDisplayProps) {
  const { busy, error, run } = useSyncAction();
  const [copied, setCopied] = useState(false);

  /** Submitting the form lets the browser offer to save the key. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onNext();
  };

  /** Copies the key and confirms it on the button. */
  const copy = () =>
    run(async () => {
      await copyRecoveryKey(recoveryKey);
      setCopied(true);
    });

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Alert
        severity="warning"
        data-help="Der Schlüssel ist der einzige Weg zu den Daten, wenn kein eigenes Gerät mehr da ist."
      >
        Ohne diesen Schlüssel sind die Daten weg, wenn alle Geräte verloren
        gehen. Niemand kann ihn zurücksetzen, auch nicht der Betreiber.
      </Alert>
      <p className="text-sm">
        Den Schlüssel jetzt im Passwortmanager speichern, ausdrucken oder als
        Datei sichern. Er wird nur dieses eine Mal angezeigt.
      </p>
      <TextField
        size="small"
        label="Benutzername"
        value={RECOVERY_KEY_USER_NAME}
        autoComplete="username"
        className="max-w-96"
        slotProps={{ htmlInput: { readOnly: true } }}
        data-help="Name, unter dem der Passwortmanager den Schlüssel speichert."
      />
      <TextField
        label="Wiederherstellungsschlüssel"
        value={recoveryKey}
        autoComplete="new-password"
        slotProps={{
          htmlInput: {
            readOnly: true,
            className: "font-mono",
            spellCheck: false,
          },
        }}
        data-help="Der Wiederherstellungsschlüssel. Groß- und Kleinschreibung spielt beim Eingeben keine Rolle."
      />
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outlined"
          disabled={busy}
          onClick={copy}
          data-help="Kopiert den Schlüssel, z. B. zum Einfügen in einen Passwortmanager."
        >
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
        <Button
          variant="outlined"
          onClick={() => printRecoveryKey(recoveryKey)}
          data-help="Druckt eine Seite nur mit dem Schlüssel. Das Blatt sicher aufbewahren."
        >
          Drucken
        </Button>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={() => run(() => saveRecoveryKey(recoveryKey))}
          data-help="Speichert den Schlüssel als Textdatei, z. B. in „Dateien“ oder auf einem USB-Stick."
        >
          Als Datei speichern
        </Button>
      </div>
      <div>
        <Button
          type="submit"
          variant="contained"
          data-help="Weiter zur Kontrolle, ob der Schlüssel gesichert ist."
        >
          Schlüssel ist gesichert
        </Button>
      </div>
    </form>
  );
}
