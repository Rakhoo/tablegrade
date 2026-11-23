import { Button, Snackbar } from "@mui/material";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { paths } from "../lib/paths";
import { rememberCurrentPageFor } from "../lib/returnPage";
import { getSyncView } from "../lib/syncView";

/**
 * Notice on every page when the sign-in ended: the app keeps working locally and syncs again
 * after a new sign-in. Can be closed until the app starts again; the settings show the
 * sign-in themselves.
 */
export function SyncSignInBanner() {
  const expired = getSyncView(useSyncStatus()) == "expired";
  const { pathname } = useLocation();
  const [closed, setClosed] = useState(false);
  const to = paths.settings("sync");
  return (
    <Snackbar
      open={expired && !closed && pathname != paths.settings()}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      data-help="Die Anmeldung für die Synchronisierung ist abgelaufen. Die App funktioniert weiter, abgeglichen wird erst nach neuer Anmeldung."
      message="Anmeldung abgelaufen. Neu anmelden, um zu synchronisieren."
      action={
        <>
          <Button
            variant="contained"
            size="small"
            component={Link}
            to={to}
            onClick={() => rememberCurrentPageFor(to)}
          >
            Anmelden
          </Button>
          <Button size="small" color="inherit" onClick={() => setClosed(true)}>
            Später
          </Button>
        </>
      }
    />
  );
}
