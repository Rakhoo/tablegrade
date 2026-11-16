import { createContext, useContext } from "react";
import { formatGrade, getGradeColor } from "../lib/grades";
import { useSettings } from "./useSettings";

/**
 * Whether the class shown shows its grades as points (see `usesPoints`); provided by the class
 * pages, so badges and labels below them format grades without passing the class along.
 */
export const PointsContext = createContext(false);

/** Formats grades for display as the current class wants it: points or marks ("2+"). */
export function useGradeFormat() {
  const points = useContext(PointsContext);
  return (value: number) => formatGrade(value, points);
}

/** Colors grades on the scale chosen in the settings (see `gradePalette`). */
export function useGradeColor() {
  const { gradePalette } = useSettings();
  return (value: number) => getGradeColor(value, gradePalette);
}
