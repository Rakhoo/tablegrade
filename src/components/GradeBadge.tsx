import type { ReactNode } from "react";
import { formatMark } from "../lib/grades";
import type { AbsentSymbol, GradeSymbol } from "../lib/gradeSymbols";

/** Strokes share these props; `color` is the glyph color. */
const stroke = (color: string, width = 2.5) => ({
  fill: "none",
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/** Draws a symbol into the badge's 24 × 24 view box. */
function getGlyph(
  symbol: GradeSymbol,
  color: string,
  label: string,
): ReactNode {
  const line = stroke(color);
  switch (symbol) {
    case "blank":
      return null;
    case "value":
      return (
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fontFamily="inherit"
          fill={color}
        >
          {label}
        </text>
      );
    case "star":
      return (
        <path
          fill={color}
          d="M12 6l1.59 4.32 4.59.17-3.61 2.84 1.25 4.43L12 15.2l-3.82 2.56 1.25-4.43-3.61-2.84 4.59-.17z"
        />
      );
    case "doubleCheck":
      return (
        <path {...stroke(color, 2)} d="M5 12.5l3 3 6-7M11 15.5l1 .5 7-8" />
      );
    case "check":
      return <path {...line} d="M7 12.5l3.5 3.5 6.5-8" />;
    case "plusPlus":
      return (
        <path
          {...stroke(color, 2.2)}
          d="M8.5 11v6M5.5 14h6M15.5 7v6M12.5 10h6"
        />
      );
    case "plus":
      return <path {...line} d="M12 7v10M7 12h10" />;
    case "circlePlus":
      return (
        <>
          <circle cx="12" cy="12" r="6.5" {...stroke(color, 1.8)} />
          <path {...stroke(color, 2)} d="M12 9v6M9 12h6" />
        </>
      );
    case "ring":
      return <circle cx="12" cy="12" r="4.5" {...line} />;
    case "dot":
      return <circle cx="12" cy="12" r="2.8" fill={color} />;
    case "tilde":
      return (
        <path {...line} d="M6.5 13.500c2-3 3.5-3 5.5-1.500s3.5 1.5 5.5-1.5" />
      );
    case "circleMinus":
      return (
        <>
          <circle cx="12" cy="12" r="6.5" {...stroke(color, 1.8)} />
          <path {...stroke(color, 2)} d="M9 12h6" />
        </>
      );
    case "minus":
      return <path {...line} d="M7 12h10" />;
    case "minusMinus":
      return <path {...line} d="M5.5 14.500h6M12.5 10h6" />;
    case "cross":
      return <path {...line} d="M8.5 8.500l7 7M15.5 8.500l-7 7" />;
    case "flash":
      return <path fill={color} d="M13.5 5l-6.5 8h4l-1 6 6.5-8h-4z" />;
    case "arrowUp":
      return <path {...line} d="M12 17V7M7.5 11.500L12 7l4.5 4.5" />;
    case "arrowDown":
      return <path {...line} d="M12 7v10M7.5 12.500L12 17l4.5-4.5" />;
    case "arrowUpRight":
      return <path {...line} d="M8 16l8-8M10 8h6v6" />;
    case "arrowDownRight":
      return <path {...line} d="M8 8l8 8M16 10v6h-6" />;
  }
}

type GradeBadgeProps = {
  symbol: GradeSymbol;
  value: number;
  color: string;
  size: number;
  /** Black outline on white instead of a colored badge, for black and white exports. */
  monochrome?: boolean;
};

/** Round badge of a grade, independent of the settings. The exports use it as a separate image. */
export function GradeBadge({
  symbol,
  value,
  color,
  size,
  monochrome = false,
}: GradeBadgeProps) {
  const label = formatMark(value).replace("-", "−");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill={monochrome ? "#ffffff" : color}
        stroke={monochrome ? "#000000" : color}
        strokeWidth="1.5"
      />
      {getGlyph(symbol, monochrome ? "#000000" : "#ffffff", label)}
    </svg>
  );
}

type AbsentBadgeProps = {
  symbol: AbsentSymbol;
  color: string;
  size: number;
  /** Fill of the badge, by default the surface color of the theme. */
  background?: string;
};

/** Badge for "excused", drawn lighter than the grades as it is no grade. */
export function AbsentBadge({
  symbol,
  color,
  size,
  background = "var(--color-surface)",
}: AbsentBadgeProps) {
  const letter = { letterE: "E", letterA: "A" }[symbol as string];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="entschuldigt"
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill={symbol == "blank" ? color : background}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={symbol == "blank" ? undefined : "3 2"}
      />
      {symbol == "slashed" && (
        <path {...stroke(color, 2)} d="M6.5 17.500l11-11" />
      )}
      {symbol == "dash" && <path {...stroke(color, 2.5)} d="M7 12h10" />}
      {letter && (
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fontFamily="inherit"
          fill={color}
        >
          {letter}
        </text>
      )}
    </svg>
  );
}
