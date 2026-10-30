import type { ReactNode } from "react";
import { getGradeDefinition, type GradeKey } from "../lib/grades";

/** White glyph drawn on top of the colored badge, in a 24×24 view box. */
const GLYPHS: Record<GradeKey, ReactNode> = {
  "1": (
    <path
      fill="white"
      d="M12 6l1.59 4.32 4.59.17-3.61 2.84 1.25 4.43L12 15.2l-3.82 2.56 1.25-4.43-3.61-2.84 4.59-.17z"
    />
  ),
  "2": (
    <path
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      d="M12 7v10M7 12h10"
    />
  ),
  "3": (
    <circle
      cx="12"
      cy="12"
      r="3.5"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
    />
  ),
  // Neutral with a tendency: arrows up and down
  "3+": (
    <path
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 16l8-8M10 8h6v6"
    />
  ),
  "3-": (
    <path
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 8l8 8M16 10v6h-6"
    />
  ),
  "4": (
    <path stroke="white" strokeWidth="2.5" strokeLinecap="round" d="M7 12h10" />
  ),
  "5": (
    <path
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      d="M8.5 8.5l7 7M15.5 8.5l-7 7"
    />
  ),
  E: (
    <path
      stroke="#9ca3af"
      strokeWidth="2"
      strokeLinecap="round"
      d="M6.5 17.5l11-11"
    />
  ),
};

/** Round, colored badge representing a grade symbol. */
export function GradeIcon({
  grade,
  size = 32,
}: {
  grade: GradeKey;
  size?: number;
}) {
  const { color, label } = getGradeDefinition(grade)!;
  const excused = grade == "E";
  return (
    <svg
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
        fill={excused ? "white" : color}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={excused ? "3 2" : undefined}
      />
      {GLYPHS[grade]}
    </svg>
  );
}
