/** Colors and labels of the warning levels ("Ermahnungen"); index = number of warnings. */
export const WARNING_LEVELS = [
  null,
  { label: "Ermahnt", mark: "!", background: "#fff3c4", accent: "#e3a400" },
  {
    label: "Zweimal ermahnt",
    mark: "!!",
    background: "#ffdde3",
    accent: "#d6455d",
  },
] as const;

/** Number of warnings after one more tap: none → first → second → none. */
export const nextWarningLevel = (warnings: number) =>
  (warnings + 1) % WARNING_LEVELS.length;
