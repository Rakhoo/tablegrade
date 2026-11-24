import { Button, TextField } from "@mui/material";
import { useState } from "react";
import { setContact, type AccountInfo } from "../../sync";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/** What the contact address is for; shown wherever it is entered. */
const CONTACT_PURPOSE =
  "Nur für Nachrichten zu Freischaltung, Wartung und Bezahlung. Keine Werbung, keine Weitergabe.";

type SyncContactFormProps = {
  /** The signed-in account. */
  account: AccountInfo;
  /** Shows the free text of the access request. */
  withNote: boolean;
  /** Text of the save button. */
  submitLabel: string;
  /** Called after saving, e.g. to close the form. */
  onDone?: () => void;
  /** Shows a button that closes the form without saving. */
  onCancel?: () => void;
};

/**
 * Form for the contact address and, for an access request, a short reason. The address of
 * the sign-in is suggested, so most people only confirm it.
 */
export function SyncContactForm({
  account,
  withNote,
  submitLabel,
  onDone,
  onCancel,
}: SyncContactFormProps) {
  const [email, setEmail] = useState(
    account.contactEmail ?? account.signedInWith?.email ?? "",
  );
  const [note, setNote] = useState(account.accessNote ?? "");
  const { busy, error, run } = useSyncAction();
  const save = () =>
    run(async () => {
      await setContact(email.trim(), note.trim());
      onDone?.();
    });
  return (
    <div className="flex flex-col gap-3">
      <TextField
        size="small"
        type="email"
        label="E-Mail-Adresse"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="max-w-96"
        helperText={CONTACT_PURPOSE}
        autoComplete="email"
        data-help="Adresse für Nachrichten zu Freischaltung, Wartung und Bezahlung. Sie liegt auf dem Server, die Schuldaten bleiben verschlüsselt."
      />
      {withNote && (
        <TextField
          size="small"
          multiline
          minRows={2}
          label="Warum möchtest du Notenfeder nutzen?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="max-w-96"
          helperText="Z. B. wer dir die App empfohlen hat oder an welcher Schule du bist."
          slotProps={{ htmlInput: { maxLength: 500 } }}
          data-help="Kurze Nachricht zur Anfrage. Hilft bei der Entscheidung über die Freischaltung."
        />
      )}
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="contained"
          disabled={busy || !email.trim()}
          onClick={() => void save()}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button disabled={busy} onClick={onCancel}>
            Abbrechen
          </Button>
        )}
      </div>
    </div>
  );
}

type SyncContactProps = {
  /** The signed-in account. */
  account: AccountInfo;
};

/** The contact address in the active view, with a button to change it. */
export function SyncContact({ account }: SyncContactProps) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Kontakt</h3>
      {editing ? (
        <SyncContactForm
          account={account}
          withNote={false}
          submitLabel="Speichern"
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div
          className="flex flex-wrap items-center gap-2 text-sm"
          data-help={CONTACT_PURPOSE}
        >
          <span>
            E-Mail:{" "}
            <span className="font-medium">
              {account.contactEmail ?? "keine angegeben"}
            </span>
          </span>
          <Button size="small" onClick={() => setEditing(true)}>
            Ändern
          </Button>
        </div>
      )}
    </div>
  );
}
