import type { SchoolClass } from "../db";
import { mixColors } from "./colors";
import { MIXED } from "./settings";

/** Pastel tile colors of the lowest level per hue: background, accent bar and text. */
const PALETTE = [
  { background: "#ede6ff", accent: "#8a6be5", text: "#4b3591" },
  { background: "#fde8f1", accent: "#e0679b", text: "#8f2f5a" },
  { background: "#e3f1ff", accent: "#5b9be6", text: "#265289" },
  { background: "#e2f6ee", accent: "#4bb38a", text: "#1f6b4e" },
  { background: "#fff1e0", accent: "#f0a04b", text: "#8a5216" },
  { background: "#f4e9fb", accent: "#b57ad8", text: "#6a3a8a" },
  { background: "#fff8d6", accent: "#d9b632", text: "#75611a" },
  { background: "#e5f5f8", accent: "#47aebf", text: "#1e6571" },
];

/** Position of mixed offers on a scale of nine levels: between 7 and 8. */
const MIXED_LEVEL = 2.5 / 8;

/** How far the highest level is shifted from the palette color towards its darker shades. */
const MAX_LEVEL_SHIFT = 0.7;
/** How far the text and accent of the highest level are darkened for contrast. */
const MAX_TEXT_DARKENING = 0.45;

/**
 * Stable color of a class: the subject's name picks the hue, so it never changes between
 * sessions, and the level sets the shade, from light (5) to dark (Q2).
 */
export function getClassColor(
  { subject, number }: Pick<SchoolClass, "subject" | "number">,
  levels: string[],
) {
  let hash = 0;
  for (const char of subject.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  const { background, accent, text } = PALETTE[Math.abs(hash) % PALETTE.length];
  const shaded = levels.filter((level) => level != MIXED);
  const shade =
    number == MIXED
      ? MIXED_LEVEL
      : Math.max(shaded.indexOf(number), 0) / Math.max(shaded.length - 1, 1);
  return {
    background: mixColors(background, accent, shade * MAX_LEVEL_SHIFT),
    accent: mixColors(accent, "#000000", shade * MAX_TEXT_DARKENING),
    text: mixColors(text, "#000000", shade * MAX_TEXT_DARKENING),
  };
}
