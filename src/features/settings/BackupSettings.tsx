import { Button, MenuItem, Snackbar, TextField } from "@mui/material";
import { format, parseISO } from "date-fns";
import { useRef, useState } from "react";
import { useRevalidator } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DownloadIcon, RefreshIcon, UploadIcon } from "../../components/icons";
import { importDatabase } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { describeFile, isSqliteFile, saveBackup } from "../../services/backup";
import { reloadApp } from "../../services/pwa";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/**
 * Backup and restore of the on-device database (e.g. to move to another iPad), the backup
 * reminder and a manual reload for updates.
 */
export function BackupSettings() {
  const { backupReminderDays, lastBackup } = useSettings();
  const save = useSaveSettings();
  const { revalidate } = useRevalidator();
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      if (await saveBackup()) {
        setMessage("Die Sicherung wurde gespeichert.");
        revalidate();
      }
    } catch (error) {
      console.error(error);
      const { name, message } = error as Error;
      setMessage(`Die Sicherung ist fehlgeschlagen (${name}: ${message}).`);
    }
  };

  const handleFile = async (input: HTMLInputElement) => {
    const picked = input.files?.[0];
    if (!picked) return;
    try {
      // Kept in memory: iOS may discard the picked file once the input is reset
      const file = new File([await picked.arrayBuffer()], picked.name);
      if (await isSqliteFile(file)) setPendingImport(file);
      else {
        setMessage(
          `Die Datei ist keine gültige Tablegrade-Sicherung (${await describeFile(file)}).`,
        );
      }
    } catch (error) {
      console.error(error);
      setMessage("Die Datei konnte nicht gelesen werden.");
    } finally {
      // Allow choosing the same file again
      input.value = "";
    }
  };

  return (
    <SettingsSection
      title="Sicherung"
      hint={`Alle Daten liegen nur auf diesem Gerät. Letzte Sicherung: ${lastBackup ? format(parseISO(lastBackup), "dd.MM.yyyy") : "noch keine"}.`}
      help="Sicherung aller Daten als Datei, Wiederherstellen aus einer Sicherung (auch zum Umzug auf ein anderes Gerät), die Erinnerung daran und ein Neustart der App für Updates."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="contained"
          startIcon={<DownloadIcon size={18} />}
          onClick={handleExport}
        >
          Sicherung exportieren
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadIcon size={18} />}
          onClick={() => fileInput.current?.click()}
        >
          Sicherung importieren
        </Button>
      </div>
      <TextField
        select
        size="small"
        label="An Sicherung erinnern"
        value={backupReminderDays}
        className="max-w-72"
        onChange={(event) =>
          save({ backupReminderDays: Number(event.target.value) })
        }
      >
        <MenuItem value={0}>Nie</MenuItem>
        <MenuItem value={7}>Nach 7 Tagen</MenuItem>
        <MenuItem value={14}>Nach 14 Tagen</MenuItem>
        <MenuItem value={30}>Nach 30 Tagen</MenuItem>
      </TextField>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <Button
          variant="outlined"
          startIcon={<RefreshIcon size={18} />}
          onClick={reloadApp}
        >
          Neu laden
        </Button>
        <span className="text-sm text-muted">
          App neu starten und Updates übernehmen
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".sqlite3,.sqlite,.db,application/x-sqlite3,application/octet-stream"
        hidden
        onChange={(event) => handleFile(event.target)}
      />

      <ConfirmDialog
        open={!!pendingImport}
        title="Sicherung importieren?"
        confirmLabel="Daten ersetzen"
        onClose={() => setPendingImport(null)}
        onConfirm={async () => {
          try {
            await importDatabase(pendingImport!);
            window.location.reload();
          } catch (error) {
            console.error(error);
            setMessage("Der Import ist fehlgeschlagen.");
          }
        }}
      >
        Alle Klassen, Schüler, Noten und Kommentare auf diesem Gerät werden
        durch den Inhalt von „{pendingImport?.name}“ ersetzt. Am besten vorher
        die aktuellen Daten exportieren.
      </ConfirmDialog>

      <Snackbar
        open={!!message}
        message={message}
        autoHideDuration={15000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </SettingsSection>
  );
}
