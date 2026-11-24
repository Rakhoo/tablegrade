import { Alert, Button } from "@mui/material";
import { useState } from "react";
import { RefreshIcon } from "../../components/icons";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { syncNow } from "../../sync";
import { SyncContactForm } from "./SyncContact";
import { SyncErrorAlert } from "./SyncErrorAlert";
import { useSyncAction } from "./useSyncAction";

/**
 * Access request of a new account: contact address and reason, then waiting for the approval.
 * The app keeps working locally meanwhile.
 */
export function SyncPending() {
  const account = useSyncStatus().account;
  const [editing, setEditing] = useState(false);
  const { busy, error, run } = useSyncAction();
  if (!account) return null;
  if (!account.contactEmail || editing)
    return (
      <>
        <Alert severity="info">
          Notenfeder ist im Moment nur nach Freischaltung nutzbar. Schreib kurz,
          warum du die App nutzen möchtest. Du bekommst eine E-Mail, sobald dein
          Konto freigeschaltet ist.
        </Alert>
        <SyncContactForm
          account={account}
          withNote
          submitLabel={editing ? "Anfrage ändern" : "Freischaltung anfragen"}
          onDone={() => setEditing(false)}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      </>
    );
  return (
    <>
      <Alert severity="success">
        Anfrage gesendet. Die Benachrichtigung kommt an{" "}
        <span className="font-medium">{account.contactEmail}</span>. Bis dahin
        funktioniert die App auf diesem Gerät wie gewohnt.
      </Alert>
      <SyncErrorAlert error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outlined"
          startIcon={<RefreshIcon size={18} />}
          disabled={busy}
          onClick={() => run(syncNow)}
          data-help="Fragt beim Server nach, ob das Konto inzwischen freigeschaltet ist."
        >
          Status prüfen
        </Button>
        <Button
          disabled={busy}
          onClick={() => setEditing(true)}
          data-help="Ändert E-Mail-Adresse oder Begründung der Anfrage."
        >
          Anfrage ändern
        </Button>
      </div>
    </>
  );
}
