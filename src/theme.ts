import { createTheme } from "@mui/material";
import { deDE as coreDeDE } from "@mui/material/locale";
import { deDE as pickersDeDE } from "@mui/x-date-pickers/locales";
import { COMPACT_QUERY } from "./hooks/useCompact";
import type { getThemeTokens } from "./lib/themes";

/** Narrow screens (phones in portrait), on which dialogs become sheets. */
const NARROW = "@media (max-width: 599.98px)";

/** Small screens, see `COMPACT_QUERY`. */
const COMPACT = `@media ${COMPACT_QUERY}`;

/** Creates the MUI theme for the selected colors: pill buttons, rounded surfaces, German texts. */
export const createAppTheme = (
  tokens: ReturnType<typeof getThemeTokens>,
  dark: boolean,
) =>
  createTheme(
    {
      palette: {
        mode: dark ? "dark" : "light",
        primary: { main: tokens["brand-600"], light: tokens["brand-100"] },
        secondary: { main: tokens["blush-400"] },
        error: { main: "#d6455d" },
        text: { primary: tokens.ink, secondary: tokens.muted },
        background: { default: tokens.canvas, paper: tokens.surface },
        divider: tokens.line,
      },
      shape: { borderRadius: 12 },
      typography: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
        button: { textTransform: "none", fontWeight: 600 },
      },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: { root: { borderRadius: 999, paddingInline: 18 } },
        },
        MuiToggleButton: {
          styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
        },
        MuiDialog: {
          styleOverrides: {
            // Narrow screens show dialogs as a sheet from the bottom, as wide as the screen
            container: {
              [NARROW]: { alignItems: "flex-end" },
            },
            paper: {
              borderRadius: 28,
              backgroundImage: "none",
              boxShadow: "0 24px 64px -16px rgb(43 37 64 / 0.3)",
              [NARROW]: {
                margin: 0,
                width: "100%",
                maxWidth: "100%",
                maxHeight: "calc(100% - env(safe-area-inset-top) - 1.5rem)",
                borderRadius: "28px 28px 0 0",
                paddingBottom: "env(safe-area-inset-bottom)",
              },
            },
          },
        },
        MuiDialogTitle: {
          styleOverrides: {
            root: {
              fontWeight: 700,
              fontSize: "1.375rem",
              padding: "24px 28px 8px",
            },
          },
        },
        MuiDialogContent: {
          styleOverrides: { root: { padding: "8px 28px 16px" } },
        },
        MuiDialogActions: {
          styleOverrides: { root: { padding: "12px 24px 20px", gap: 4 } },
        },
        MuiPopover: {
          styleOverrides: {
            paper: {
              borderRadius: 24,
              backgroundImage: "none",
              boxShadow: "0 16px 48px -12px rgb(43 37 64 / 0.28)",
            },
          },
        },
        MuiSnackbar: {
          styleOverrides: {
            // Above the bars and the round menu button at the bottom of small screens
            anchorOriginBottomCenter: {
              [COMPACT]: { bottom: "calc(env(safe-area-inset-bottom) + 7rem)" },
            },
          },
        },
        MuiMenu: {
          styleOverrides: { paper: { borderRadius: 16 } },
        },
        MuiOutlinedInput: {
          styleOverrides: { root: { borderRadius: 14 } },
        },
        MuiAlert: {
          styleOverrides: { root: { borderRadius: 14 } },
        },
      },
    },
    pickersDeDE,
    coreDeDE,
  );
