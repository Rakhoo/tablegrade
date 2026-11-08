import type { ReportKind } from "../../lib/reports";

/** Cell tints like a soft checkerboard: the row picks the hue, the column the strength. */
export const CELL_TINTS = [
  ["var(--color-brand-50)", "var(--color-brand-100)"],
  ["var(--color-blush-50)", "var(--color-blush-100)"],
];

/** Marker of a report grade set by hand where too few assessments gave "n.b.". */
export const OVERRIDE_COLOR = "#ca8a04";

/** Frame of the cells in the column of the current lesson. */
export const LESSON_FRAME =
  "inset 2px 0 0 var(--color-brand-500), inset -2px 0 0 var(--color-brand-500)";

/** Header tints per column, matching the strength of the names in the first column. */
export const HEADER_TINTS = ["var(--color-brand-50)", "var(--color-brand-200)"];

/** Colors setting the columns of a report apart from the lessons and each other. */
export const REPORT_COLORS: Record<ReportKind, string> = {
  partial: "#0f766e",
  half: "#b45309",
};

/** A report's color mixed into the surface, which adapts it to light and dark mode. */
export const getReportTint = (kind: ReportKind, strength: number) =>
  `color-mix(in srgb, ${REPORT_COLORS[kind]} ${strength}%, var(--color-surface))`;

/** Height of a date header times the tangent of its slant: how far its top is shifted right. */
export const HEADER_SLANT = "calc(6rem * 0.577)";
