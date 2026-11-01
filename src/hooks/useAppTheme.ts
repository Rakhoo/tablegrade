import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { getThemeTokens, type ColorMode, type ThemeId } from "../lib/themes";
import { createAppTheme } from "../theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const subscribeToDevice = (onChange: () => void) => {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * Builds the MUI theme and applies the colors as CSS variables, which override the tokens
 * of `index.css`. "system" follows the device, also while the app is running.
 */
export function useAppTheme(themeId: ThemeId, colorMode: ColorMode) {
  const deviceIsDark = useSyncExternalStore(
    subscribeToDevice,
    () => window.matchMedia(DARK_QUERY).matches,
  );
  const dark = colorMode == "dark" || (colorMode == "system" && deviceIsDark);
  const tokens = useMemo(() => getThemeTokens(themeId, dark), [themeId, dark]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(tokens)) {
      root.style.setProperty(`--color-${name}`, value);
    }
    root.style.colorScheme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", tokens.canvas);
  }, [tokens, dark]);

  return useMemo(() => createAppTheme(tokens, dark), [tokens, dark]);
}
