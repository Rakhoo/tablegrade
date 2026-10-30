/** Color of each trait, by its name in the `Traits` table. */
const TRAIT_COLORS: Record<string, string> = {
  ADHS: "#4f46e5",
  ADS: "#38bdf8",
  Autismus: "#14b8a6",
  Diabetes: "#ec4899",
  ESE: "#a855f7",
  Lernen: "#84cc16",
  LRS: "#b45309",
};

/** Color of a trait; unknown traits fall back to a neutral gray. */
export const getTraitColor = (name: string) => TRAIT_COLORS[name] ?? "#9ca3af";
