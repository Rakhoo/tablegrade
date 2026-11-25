import { useMediaQuery } from "@mui/material";

/**
 * Small screens: phones in both orientations and narrow windows. The same limits as the
 * `compact:` variant in `index.css`.
 */
export const COMPACT_QUERY = "(max-width: 599.98px), (max-height: 499.98px)";

/** Whether the screen is small (see `COMPACT_QUERY`), e.g. a phone. */
export const useCompact = () => useMediaQuery(COMPACT_QUERY, { noSsr: true });

/** Whether the screen is low, e.g. a phone in landscape (`short:` in `index.css`). */
export const useShort = () =>
  useMediaQuery("(max-height: 499.98px)", { noSsr: true });

/** Whether the screen is wider than high. */
export const useLandscape = () =>
  useMediaQuery("(orientation: landscape)", { noSsr: true });
