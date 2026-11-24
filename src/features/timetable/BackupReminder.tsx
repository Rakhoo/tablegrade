import { Button, Snackbar } from "@mui/material";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { useSettings } from "../../hooks/useSettings";
import { saveBackup } from "../../services/backup";
import { isBackupDue } from "../../lib/attention";

/** Reminds of a backup once the last one is older than set; all data is only on this device. */
export function BackupReminder() {
  const { backupReminderDays, lastBackup } = useSettings();
  const { revalidate } = useRevalidator();
  const [dismissed, setDismissed] = useState(false);

  const isDue = isBackupDue(backupReminderDays, lastBackup);

  return (
    <Snackbar
      open={isDue && !dismissed}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      message={
        lastBackup
          ? "Die letzte Sicherung ist schon länger her."
          : "Es gibt noch keine Sicherung deiner Daten."
      }
      action={
        <>
          <Button
            color="inherit"
            size="small"
            onClick={() => setDismissed(true)}
          >
            Später
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={async () => {
              if (await saveBackup()) {
                setDismissed(true);
                revalidate();
              }
            }}
          >
            Jetzt sichern
          </Button>
        </>
      }
    />
  );
}
