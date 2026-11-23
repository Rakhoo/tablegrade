import { Alert, Button } from "@mui/material";
import { dismissImportNotice } from "../sync";

/** Help text of the notice after a backup import turned sync off. */
export const IMPORT_NOTICE_HELP =
  "Beim Einspielen einer Sicherung schaltet die App die Synchronisierung aus, damit die alten Daten nicht die Daten auf den anderen Geräten überschreiben.";

/** Message of the notice after a backup import turned sync off. */
export const IMPORT_NOTICE_MESSAGE =
  "Sicherung eingespielt. Synchronisierung ist aus. Zum Fortsetzen neu einschalten.";

/** Hides the import notice for good, on every page and in the settings. */
export function DismissImportNoticeButton() {
  return (
    <Button
      variant="contained"
      size="small"
      onClick={() => void dismissImportNotice()}
      data-help="Blendet den Hinweis zur eingespielten Sicherung aus."
    >
      Verstanden
    </Button>
  );
}

/** Notice in the sync settings after a backup import turned sync off. */
export function SyncImportNotice() {
  return (
    <Alert
      severity="info"
      data-help={IMPORT_NOTICE_HELP}
      action={<DismissImportNoticeButton />}
    >
      {IMPORT_NOTICE_MESSAGE}
    </Alert>
  );
}
