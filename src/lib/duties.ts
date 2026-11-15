/** Keys of the duty symbols; drawn by `DutySymbol` in `src/components/dutySymbols.tsx`. */
export const DUTY_SYMBOL_KEYS = [
  "board",
  "broom",
  "bin",
  "book",
  "envelope",
  "monitor",
  "window",
  "plant",
  "bulb",
  "tablet",
  "key",
  "clock",
  "star",
] as const;

export type DutySymbolKey = (typeof DUTY_SYMBOL_KEYS)[number];

/** Longest duty name: one or two words, e.g. "Lüftung/Fenster" or "Klassenbuchdienst". */
export const MAX_DUTY_NAME_LENGTH = 24;

/**
 * Colors of the duty symbols: cool and neutral tones only, so a duty never looks like the
 * yellow and red warnings ("Ermahnt", "Maßnahme") next to it.
 */
export const DUTY_COLORS = [
  "#0d9488",
  "#4338ca",
  "#475569",
  "#7c3aed",
  "#0284c7",
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#9333ea",
  "#4d7c0f",
  "#059669",
  "#6b4f3a",
];

/** Usual class duties, offered for adding with a fitting symbol and color. */
export const SUGGESTED_DUTIES: {
  name: string;
  symbol: DutySymbolKey;
  color: string;
}[] = [
  { name: "Tafel", symbol: "board", color: "#0d9488" },
  { name: "Ordnung", symbol: "broom", color: "#4338ca" },
  { name: "Müll", symbol: "bin", color: "#475569" },
  { name: "Klassenbuch", symbol: "book", color: "#7c3aed" },
  { name: "Botengänge", symbol: "envelope", color: "#0284c7" },
  { name: "Medien", symbol: "monitor", color: "#2563eb" },
  { name: "iPad", symbol: "tablet", color: "#059669" },
  { name: "Lüftung/Fenster", symbol: "window", color: "#0891b2" },
  { name: "Blumen", symbol: "plant", color: "#16a34a" },
  { name: "Energie/Licht", symbol: "bulb", color: "#9333ea" },
];
