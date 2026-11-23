/**
 * Build-time settings of sync. Kept apart from the logic modules, because Vite's
 * `import.meta.env` is not available in the Node tests.
 */

/** Server origin of the build, e.g. `https://pi.example.ts.net`; empty without a server. */
export const SYNC_URL: string = import.meta.env.VITE_SYNC_URL ?? "";
