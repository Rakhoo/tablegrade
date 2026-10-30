import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { ReactNode } from "react";
import { MoreIcon, ShareIcon } from "../../components/icons";
import { getInstallPlatform, promptInstall } from "../../services/pwa";

/** Inline symbol inside an instruction step. */
const Symbol = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex translate-y-1 rounded-md bg-brand-50 p-0.5 text-brand-600">
    {children}
  </span>
);

/** Numbered installation steps per platform. */
const STEPS: Record<string, ReactNode[]> = {
  ios: [
    <>
      In Safari oben rechts auf{" "}
      <Symbol>
        <ShareIcon size={16} />
      </Symbol>{" "}
      „Teilen“ tippen.
    </>,
    <>„Zum Home-Bildschirm“ wählen (ggf. in der Liste nach unten scrollen).</>,
    <>
      Mit „Hinzufügen“ bestätigen. Die App liegt dann auf dem Home-Bildschirm.
    </>,
  ],
  "ios-other-browser": [
    <>
      Auf{" "}
      <Symbol>
        <ShareIcon size={16} />
      </Symbol>{" "}
      „Teilen“ tippen (bei Chrome in der Adressleiste).
    </>,
    <>„Zum Home-Bildschirm“ wählen.</>,
    <>
      Mit „Hinzufügen“ bestätigen. Falls der Eintrag fehlt, die Seite in Safari
      öffnen.
    </>,
  ],
  "mac-safari": [
    <>Im Menü „Ablage“ den Eintrag „Zum Dock hinzufügen“ wählen.</>,
    <>Mit „Hinzufügen“ bestätigen.</>,
  ],
  android: [
    <>
      Im Browser-Menü{" "}
      <Symbol>
        <MoreIcon size={16} />
      </Symbol>{" "}
      „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.
    </>,
    <>Mit „Installieren“ bestätigen.</>,
  ],
  desktop: [
    <>
      In der Adressleiste auf das Installieren-Symbol klicken, oder im
      Browser-Menü „App installieren“ wählen.
    </>,
    <>Mit „Installieren“ bestätigen.</>,
  ],
};

const MESSAGES: Record<string, string> = {
  installed: "Die App ist auf diesem Gerät bereits installiert.",
  prompt: "Dieser Browser kann die App direkt installieren.",
  unsupported:
    "Dieser Browser kann die App nicht installieren. Am besten Safari (iPad, iPhone, Mac), Chrome oder Edge verwenden.",
};

type InstallDialogProps = { onClose: () => void };

/**
 * Explains how to install the app on the detected platform. The caller makes sure the
 * URL is clean meanwhile, since iPadOS keeps the current URL as the app's start page.
 * Mount it only while open.
 */
export function InstallDialog({ onClose }: InstallDialogProps) {
  const platform = getInstallPlatform();
  const steps = STEPS[platform];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>App installieren</DialogTitle>
      <DialogContent>
        <p className="mb-3 text-muted">
          Installiert startet Tablegrade wie eine eigene App vom
          Home-Bildschirm, auch ohne Internet.
        </p>
        {steps ? (
          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>{MESSAGES[platform]}</p>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
        {platform == "prompt" && (
          <Button
            variant="contained"
            onClick={async () => {
              await promptInstall();
              onClose();
            }}
          >
            Installieren
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
