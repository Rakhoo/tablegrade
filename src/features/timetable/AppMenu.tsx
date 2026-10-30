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
  InstallIcon,
  MoreIcon,
  RefreshIcon,
  UploadIcon,
} from "../../components/icons";
import { importDatabase } from "../../db";
import { useSearchParams } from "react-router";
import { isSqliteFile, saveBackup } from "../../services/backup";
import { reloadApp } from "../../services/pwa";
import { InstallDialog } from "./InstallDialog";

/**
 * "⋯" menu of the timetable: backup and restore of the on-device database (e.g. to move
 * to another iPad), manual reload for updates and installation instructions.
 */
export function AppMenu() {
  const [, setSearchParams] = useSearchParams();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [showInstall, setShowInstall] = useState(false);
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

  const handleFile = async (input: HTMLInputElement) => {
    const picked = input.files?.[0];
    if (!picked) return;
    try {
      // Kept in memory: iOS may discard the picked file once the input is reset
      const file = new File([await picked.arrayBuffer()], picked.name);
      if (await isSqliteFile(file)) setPendingImport(file);
      else setMessage("Die Datei ist keine gültige Tablegrade-Sicherung.");
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
        <MenuItem onClick={reloadApp}>
          <ListItemIcon>
            <RefreshIcon />
          </ListItemIcon>
          <ListItemText
            primary="Neu laden"
            secondary="App neu starten und Updates übernehmen"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            // iPadOS installs the current URL as start page, so it must be clean
            setSearchParams({}, { replace: true });
            setShowInstall(true);
          }}
        >
          <ListItemIcon>
            <InstallIcon />
          </ListItemIcon>
          <ListItemText
            primary="App installieren"
            secondary="Anleitung für den Home-Bildschirm"
          />
        </MenuItem>
      </Menu>

      {showInstall && <InstallDialog onClose={() => setShowInstall(false)} />}

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
        autoHideDuration={5000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
