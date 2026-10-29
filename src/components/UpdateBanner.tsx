import { Button, Snackbar } from "@mui/material";
import { useRegisterSW } from "virtual:pwa-register/react";

/** How often a running app looks for a new version (an iPad PWA may stay open for days). */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

/**
 * Registers the service worker and shows a banner once a new app version is ready.
 * Reloading through the banner activates it, which is hard to trigger manually in an iPad PWA.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_, registration) => {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update();
      };
      setInterval(check, UPDATE_CHECK_INTERVAL);
      // Also check whenever the app comes back to the foreground
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState == "visible") check();
      });
    },
  });

  return (
    <Snackbar
      open={needRefresh}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      message="Eine neue Version ist verfügbar."
      action={
        <Button
          variant="contained"
          size="small"
          onClick={() => updateServiceWorker(true)}
        >
          Aktualisieren
        </Button>
      }
    />
  );
}
