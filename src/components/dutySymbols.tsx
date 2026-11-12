import type { CSSProperties, ReactNode } from "react";
import type { Duty } from "../db";
import type { DutySymbolKey } from "../lib/duties";

/** The strokes of each duty symbol on a 24 × 24 grid. */
const SYMBOL_PATHS: Record<DutySymbolKey, ReactNode> = {
  board: <path d="M3 4h18v11H3zM8 20l2-5M16 20l-2-5M7 8h6M7 11h4" />,
  broom: <path d="M16 2l-4 9M7 11h9l2 10H5zM9 21l.5-5M13 21v-5" />,
  bin: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />,
  book: (
    <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11M9 8h5" />
  ),
  envelope: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
  monitor: <path d="M3 4h18v12H3zM8 20h8M12 16v4" />,
  window: <path d="M5 3h14v18H5zM12 3v18M5 12h14" />,
  plant: (
    <path d="M12 20v-8M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-4 3-6 7-6 0 4-3 6-7 6zM7 20h10" />
  ),
  bulb: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
  ),
  key: (
    <path d="M11.5 12.5a4 4 0 1 1-5.7 5.7 4 4 0 0 1 5.7-5.7zM11.5 12.5L20 4M17 7l3 3M15 9l2 2" />
  ),
  clock: <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2" />,
  star: (
    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />
  ),
};

type DutySymbolProps = { symbol: string; size?: number };

/** The symbol of a duty in the current text color; unknown keys draw a star. */
export function DutySymbol({ symbol, size = 20 }: DutySymbolProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {SYMBOL_PATHS[symbol as DutySymbolKey] ?? SYMBOL_PATHS.star}
    </svg>
  );
}

type DutyBadgeProps = {
  duty: Pick<Duty, "symbol" | "color" | "name">;
  /** Diameter in pixels. */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** A duty as a white symbol on a circle of its color. */
export function DutyBadge({
  duty,
  size = 24,
  className = "",
  style,
}: DutyBadgeProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, background: duty.color, ...style }}
      title={duty.name}
    >
      <DutySymbol symbol={duty.symbol} size={Math.round(size * 0.6)} />
    </span>
  );
}
