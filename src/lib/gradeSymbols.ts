/**
 * Symbols for oral grades. `from` and `to` limit the grades a symbol makes sense for: no minus
 * for good grades and no plus for bad ones. Their drawings are in `GradeIcon`.
 */
export const GRADE_SYMBOLS = {
  blank: { label: "Nur Farbe", from: 1, to: 6 },
  value: { label: "Zahlenwert", from: 1, to: 6 },
  star: { label: "Stern", from: 1, to: 2 },
  doubleCheck: { label: "Doppelhaken", from: 1, to: 2.3 },
  plusPlus: { label: "Plus Plus", from: 1, to: 2.3 },
  arrowUp: { label: "Pfeil hoch", from: 1, to: 2.7 },
  check: { label: "Haken", from: 1, to: 3 },
  plus: { label: "Plus", from: 1, to: 3 },
  circlePlus: { label: "Plus im Kreis", from: 1.7, to: 3 },
  arrowUpRight: { label: "Pfeil schräg hoch", from: 1.7, to: 3.3 },
  ring: { label: "Kreis", from: 2, to: 4.3 },
  dot: { label: "Punkt", from: 2.3, to: 3.7 },
  tilde: { label: "Tilde", from: 2.7, to: 4 },
  arrowDownRight: { label: "Pfeil schräg runter", from: 2.7, to: 4.7 },
  circleMinus: { label: "Minus im Kreis", from: 3, to: 5.3 },
  minus: { label: "Minus", from: 3, to: 6 },
  arrowDown: { label: "Pfeil runter", from: 3.3, to: 6 },
  minusMinus: { label: "Minus Minus", from: 3.7, to: 6 },
  cross: { label: "Kreuz", from: 4.3, to: 6 },
  flash: { label: "Blitz", from: 4.7, to: 6 },
} as const;

export type GradeSymbol = keyof typeof GRADE_SYMBOLS;

/** Symbols for absent students. */
export const ABSENT_SYMBOLS = {
  slashed: "Durchgestrichen",
  dashed: "Gestrichelt",
  letterA: "Buchstabe A",
  dash: "Strich",
  blank: "Nur Farbe",
} as const;

export type AbsentSymbol = keyof typeof ABSENT_SYMBOLS;

/** The symbols that can be chosen for a grade. */
export const getSymbolsForGrade = (value: number) =>
  (Object.keys(GRADE_SYMBOLS) as GradeSymbol[]).filter(
    (symbol) =>
      value >= GRADE_SYMBOLS[symbol].from && value <= GRADE_SYMBOLS[symbol].to,
  );
