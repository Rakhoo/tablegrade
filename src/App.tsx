import {
  CssBaseline,
  GlobalStyles,
  StyledEngineProvider,
  ThemeProvider,
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { de } from "date-fns/locale/de";
import { StrictMode, useEffect, useState } from "react";
import { Outlet, useLoaderData } from "react-router";
import { LockScreen } from "./components/LockScreen";
import { StorageErrorPage } from "./features/errors/StorageErrorPage";
import { UpdateBanner } from "./components/UpdateBanner";
import { useAppTheme } from "./hooks/useAppTheme";
import { PIN_LOCK_ENABLED } from "./lib/pin";
import type { RootLoaderData } from "./rootLoader";
import "./App.css";

/** Time in the background after which the app asks for the PIN again. */
const LOCK_AFTER_MS = 5 * 60 * 1000;

/** Root layout providing theme, German date localization and the PIN lock to all pages. */
export function App() {
  const { settings, persistent } = useLoaderData<RootLoaderData>();
  const theme = useAppTheme(settings.theme, settings.colorMode);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let hiddenSince = 0;
    const handleVisibility = () => {
      if (document.hidden) hiddenSince = Date.now();
      else if (Date.now() - hiddenSince > LOCK_AFTER_MS) setUnlocked(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return (
    <StrictMode>
      <StyledEngineProvider enableCssLayer>
        {/* Emotion's style tags come first, so the layer order must be declared here */}
        <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme={false} />
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
            <div className="app">
              {!persistent ? (
                <StorageErrorPage />
              ) : PIN_LOCK_ENABLED && settings.pinHash && !unlocked ? (
                <LockScreen
                  pinHash={settings.pinHash}
                  onUnlock={() => setUnlocked(true)}
                />
              ) : (
                <Outlet />
              )}
            </div>
            <UpdateBanner />
          </LocalizationProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </StrictMode>
  );
}
