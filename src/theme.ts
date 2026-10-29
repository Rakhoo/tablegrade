import { createTheme } from "@mui/material";
import { deDE as coreDeDE } from "@mui/material/locale";
import { deDE as pickersDeDE } from "@mui/x-date-pickers/locales";

/** Colors shared with the CSS tokens in `src/index.css`. */
export const COLORS = {
  canvas: "#f5f2fb",
  ink: "#2b2540",
  muted: "#7d7594",
  line: "#ebe6f4",
  brand: "#7352d0",
  brandLight: "#ede6ff",
  blush: "#d9578f",
};

/** App-wide MUI theme: soft lavender look, pill buttons, rounded surfaces, German texts. */
export const theme = createTheme(
  {
    palette: {
      primary: { main: COLORS.brand, light: COLORS.brandLight },
      secondary: { main: COLORS.blush },
      error: { main: "#d6455d" },
      text: { primary: COLORS.ink, secondary: COLORS.muted },
      background: { default: COLORS.canvas, paper: "#ffffff" },
      divider: COLORS.line,
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
          paper: {
            borderRadius: 28,
            boxShadow: "0 24px 64px -16px rgb(43 37 64 / 0.3)",
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
            boxShadow: "0 16px 48px -12px rgb(43 37 64 / 0.28)",
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
