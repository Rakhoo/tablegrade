/**
 * Warning levels; index = number of warnings. The second one marks that a warning was not
 * enough and an educational measure is needed. The backgrounds are theme tokens, as they
 * differ between light and dark mode.
 */
export const WARNING_LEVELS = [
  null,
  {
    label: "Ermahnt",
    mark: "!",
    background: "var(--color-warning-1)",
    accent: "#e3a400",
  },
  {
    label: "Maßnahme",
    mark: "!!",
    background: "var(--color-warning-2)",
    accent: "#d6455d",
  },
] as const;

/** Number of warnings after one more tap: none → first → second → none. */
export const nextWarningLevel = (warnings: number) =>
  (warnings + 1) % WARNING_LEVELS.length;
