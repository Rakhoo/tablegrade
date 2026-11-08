import {
  Button,
  CssBaseline,
  GlobalStyles,
  StyledEngineProvider,
  ThemeProvider,
} from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { MoreIcon, ShareIcon } from "../../components/icons";
import { useAppTheme } from "../../hooks/useAppTheme";
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

const UNSUPPORTED_MESSAGE =
  "Dieser Browser kann die App nicht installieren. Am besten Safari (iPad, iPhone, Mac), Chrome oder Edge verwenden.";

/**
 * The only page outside of the installed app: explains the installation on the detected
 * platform. It needs no database or router, the app itself only runs installed.
 */
export function InstallPage() {
  const theme = useAppTheme("lavender", "system");
  const [platform, setPlatform] = useState(getInstallPlatform);
  const [installed, setInstalled] = useState(false);
  const steps = STEPS[platform];

  useEffect(() => {
    /** The browser may offer its install dialog only after the page was shown */
    const update = () => setPlatform(getInstallPlatform());
    const finish = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", update);
    window.addEventListener("appinstalled", finish);
    return () => {
      window.removeEventListener("beforeinstallprompt", update);
      window.removeEventListener("appinstalled", finish);
    };
  }, []);

  return (
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme={false} />
        <div className="flex min-h-dvh items-center justify-center p-4">
          <main className="card flex w-full max-w-md flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <img
                src="/apple-touch-icon.png"
                alt=""
                className="h-14 w-14 rounded-2xl"
              />
              <h1 className="text-2xl font-bold tracking-tight">Tablegrade</h1>
            </div>
            <p className="text-muted">
              Diese App läuft nur installiert. So bleiben alle Daten sicher auf
              diesem Gerät, und sie funktioniert auch ohne Internet.
            </p>
            {installed ? (
              <p className="font-semibold">
                Die App ist installiert und lässt sich jetzt vom Home-Bildschirm
                öffnen.
              </p>
            ) : platform == "prompt" ? (
              <Button variant="contained" size="large" onClick={promptInstall}>
                App installieren
              </Button>
            ) : steps ? (
              <ol className="flex flex-col gap-3">
                {steps.map((step, index) => (
                  // The steps are fixed, so their position identifies them
                  // oxlint-disable-next-line react/no-array-index-key
                  <li key={index} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{UNSUPPORTED_MESSAGE}</p>
            )}
          </main>
        </div>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
