import type { SchoolClass } from "../db";
import { formatClassName, formatSchoolYear } from "./formatters";
import { CLASS_LEVELS } from "./schoolYear";

/** Text of a class in the "copy students from" search. */
export const getCopyLabel = (cls: SchoolClass) =>
  `${formatClassName(cls)} ${cls.subject} (${formatSchoolYear(cls.year)})`;

/** Sorts classes for copying: newest school year first, then descending by name. */
export const sortCopyClasses = (classes: SchoolClass[]) =>
  [...classes].sort(
    (a, b) =>
      b.year - a.year ||
      getCopyLabel(b).localeCompare(getCopyLabel(a), "de", { numeric: true }),
  );

/**
 * Filters the copy options. With a search text all of its words must match. Without one only
 * likely sources are offered: the same level this year or the level below last year, with the
 * same letter (any letter for targets without one, e.g. EF after 10a), or all classes if there
 * is none of these.
 */
export function filterCopyClasses(
  classes: SchoolClass[],
  search: string,
  target: Pick<SchoolClass, "number" | "letter" | "year">,
) {
  const words = search.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return classes.filter((cls) => {
      const label = getCopyLabel(cls).toLocaleLowerCase("de");
      return words.every((word) => label.includes(word));
    });
  }
  const previousLevel = CLASS_LEVELS[CLASS_LEVELS.indexOf(target.number) - 1];
  const suggestions = classes.filter(
    (cls) =>
      (!target.letter || cls.letter == target.letter) &&
      ((cls.number == target.number && cls.year == target.year) ||
        (cls.number == previousLevel && cls.year == target.year - 1)),
  );
  return suggestions.length > 0 ? suggestions : classes;
}
