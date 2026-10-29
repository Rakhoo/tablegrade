import type { SchoolClass } from "../db";

/** Display name of a class, e.g. "5a" or "Q1". */
export const formatClassName = (cls: Pick<SchoolClass, "number" | "letter">) =>
  cls.number + (cls.letter ?? "");

/** Display label of a school year, e.g. "2026/27". */
export const formatSchoolYear = (year: number) =>
  `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
