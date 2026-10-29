import {
  CssBaseline,
  GlobalStyles,
  StyledEngineProvider,
  ThemeProvider,
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { de } from "date-fns/locale/de";
import { StrictMode } from "react";
import { Outlet } from "react-router";
import { UpdateBanner } from "./components/UpdateBanner";
import { theme } from "./theme";
import "./App.css";

/** Root layout providing theme and German date localization to all pages. */
export function App() {
  return (
    <StrictMode>
      <StyledEngineProvider enableCssLayer>
        {/* Emotion's style tags come first, so the layer order must be declared here */}
        <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme={false} />
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
            <div className="app">
              <Outlet />
            </div>
            <UpdateBanner />
          </LocalizationProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </StrictMode>
  );
}
