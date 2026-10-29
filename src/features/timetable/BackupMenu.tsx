import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
} from "@mui/material";
import { useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DownloadIcon, MoreIcon, UploadIcon } from "../../components/icons";
import { importDatabase } from "../../db";
import { isSqliteFile, saveBackup } from "../../services/backup";

/**
 * "⋯" menu for backing up the on-device database and restoring it from a file,
 * e.g. to move all data to another iPad.
 */
export function BackupMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setAnchor(null);
    try {
      await saveBackup();
    } catch (error) {
      console.error(error);
      setMessage("Die Sicherung konnte nicht erstellt werden.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (await isSqliteFile(file)) setPendingImport(file);
    else setMessage("Die Datei ist keine gültige Tablegrade-Sicherung.");
  };

  return (
    <>
      <IconButton
        aria-label="Daten sichern oder wiederherstellen"
        onClick={(event) => setAnchor(event.currentTarget)}
        className="bg-brand-50"
      >
        <MoreIcon />
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleExport}>
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText
            primary="Sicherung exportieren"
            secondary="Alle Daten als Datei speichern"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            fileInput.current?.click();
          }}
        >
          <ListItemIcon>
            <UploadIcon />
          </ListItemIcon>
          <ListItemText
            primary="Sicherung importieren"
            secondary="Daten aus einer Datei wiederherstellen"
          />
        </MenuItem>
      </Menu>

      <input
        ref={fileInput}
        type="file"
        accept=".sqlite3,.sqlite,.db,application/x-sqlite3,application/octet-stream"
        hidden
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          // Allow choosing the same file again
          event.target.value = "";
        }}
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
        autoHideDuration={5000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
