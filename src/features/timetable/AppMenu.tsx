import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
} from "@mui/material";
import { useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  DownloadIcon,
  MoreIcon,
  RefreshIcon,
  SettingsIcon,
  UploadIcon,
} from "../../components/icons";
import { importDatabase } from "../../db";
import { Link } from "react-router";
import { describeFile, isSqliteFile, saveBackup } from "../../services/backup";
import { reloadApp } from "../../services/pwa";

/**
 * "⋯" menu of the timetable: backup and restore of the on-device database (e.g. to move
 * to another iPad), the settings and a manual reload for updates.
 */
export function AppMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setAnchor(null);
    try {
      if (await saveBackup()) setMessage("Die Sicherung wurde gespeichert.");
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
    <>
      <IconButton
        aria-label="Weitere Funktionen"
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
        <Divider />
        <MenuItem component={Link} to="/settings">
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText
            primary="Einstellungen"
            secondary="Schuljahre, Darstellung, Benotung und mehr"
          />
        </MenuItem>
        <MenuItem onClick={reloadApp}>
          <ListItemIcon>
            <RefreshIcon />
          </ListItemIcon>
          <ListItemText
            primary="Neu laden"
            secondary="App neu starten und Updates übernehmen"
          />
        </MenuItem>
      </Menu>

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
    </>
  );
}
