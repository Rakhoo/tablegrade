import { Button, Snackbar } from "@mui/material";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { paths } from "../lib/paths";
import { rememberCurrentPageFor } from "../lib/returnPage";
import { getSyncView, type SyncView } from "../lib/syncView";
import { reloadApp } from "../services/pwa";
import {
  DismissImportNoticeButton,
  IMPORT_NOTICE_HELP,
  IMPORT_NOTICE_MESSAGE,
} from "./SyncImportNotice";

/** Link to the sync settings, which show the sign-in. */
const SYNC_SETTINGS = paths.settings("sync");

/** Content of a notice: help text, message and the button that fixes the state. */
type Notice = { help: string; message: string; action: ReactNode };

/** Notices for the views in which sync stopped but the app keeps working locally. */
const NOTICES: Partial<Record<SyncView, Notice>> = {
  expired: {
    help: "Die Anmeldung für die Synchronisierung ist abgelaufen. Die App funktioniert weiter, abgeglichen wird erst nach neuer Anmeldung.",
    message: "Anmeldung abgelaufen. Neu anmelden, um zu synchronisieren.",
    action: (
      <Button
        variant="contained"
        size="small"
        component={Link}
        to={SYNC_SETTINGS}
        onClick={() => rememberCurrentPageFor(SYNC_SETTINGS)}
      >
        Anmelden
      </Button>
    ),
  },
  upgrade: {
    help: "Für die Synchronisierung braucht es eine neuere Version der App. Die App funktioniert weiter, abgeglichen wird erst nach dem Neuladen.",
    message: "Update nötig. Neu laden, um wieder zu synchronisieren.",
    action: (
      <Button variant="contained" size="small" onClick={reloadApp}>
        Neu laden
      </Button>
    ),
  },
};

/** Notice after a backup import turned sync off; it stays until dismissed. */
const IMPORT_NOTICE: Notice = {
  help: IMPORT_NOTICE_HELP,
  message: IMPORT_NOTICE_MESSAGE,
  action: <DismissImportNoticeButton />,
};

/**
 * Notice on every page when sync stopped but the app keeps working locally: the sign-in ended
 * (sign in again), the app is too old for the server (reload) or a backup import turned sync
 * off (turn it on again). Can be closed until the app starts again; the settings show the same
 * state themselves.
 */
export function SyncNoticeBanner() {
  const status = useSyncStatus();
  const notice = status.importNotice
    ? IMPORT_NOTICE
    : NOTICES[getSyncView(status)];
  const { pathname } = useLocation();
  const [closed, setClosed] = useState(false);
  return (
    <Snackbar
      open={notice != null && !closed && pathname != paths.settings()}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      data-help={notice?.help}
      message={notice?.message}
      action={
        <>
          {notice?.action}
          <Button size="small" color="inherit" onClick={() => setClosed(true)}>
            Später
          </Button>
        </>
      }
    />
  );
}
