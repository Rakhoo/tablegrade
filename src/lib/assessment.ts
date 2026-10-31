import type { GradeEntry } from "../db";
import {
  DEFAULT_GRADE_TOOL,
  getGradeDefinition,
  getMarkValue,
  GRADES,
  type GradeKey,
  type LessonType,
} from "./grades";

/** Fewest assessments needed for a result; below that a student counts as "n.b.". */
const MIN_ASSESSMENTS = 3;

/** Weight of a student's exams in the final grade; the rest is oral and projects. */
const EXAM_SHARE = 0.5;
/** Weight of the projects within the non-exam part, the rest is oral participation. */
const PROJECT_SHARE = 0.5;

/** Parts of a student's result; a part is `null` if it has no assessments. */
export type StudentResult = {
  oral: number | null;
  project: number | null;
  exam: number | null;
  /** Final grade, `null` for "n.b." (too few assessments). */
  total: number | null;
};

const average = (values: number[]) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

/**
 * Average of the symbols, where recent ones count more: the oldest counts once, the second
 * oldest twice and so on. "Excused" and missing entries are not part of it.
 */
export function getOralAverage(entries: GradeEntry[]) {
  const values = entries
    .filter((entry) => getGradeDefinition(entry.grade)?.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => getGradeDefinition(entry.grade)!.value!);
  if (values.length == 0) return null;
  const weights = values.map((_, index) => index + 1);
  const total = values.reduce(
    (sum, value, index) => sum + value * weights[index],
    0,
  );
  return total / weights.reduce((sum, weight) => sum + weight, 0);
}

/** Mixes two parts by the share of the first; a missing part leaves all to the other one. */
function combine(first: number | null, second: number | null, share: number) {
  if (first == null) return second;
  if (second == null) return first;
  return first * share + second * (1 - share);
}

/**
 * Calculates a student's result from all entries up to `asOf` (`YYYY-MM-DD`):
 * exams count 50 %, the other 50 % split evenly into projects and oral participation.
 * @param entries The entries of one student in one class.
 * @param typeOf Returns the type of the lesson on a date.
 */
export function getStudentResult(
  entries: GradeEntry[],
  typeOf: (date: string) => LessonType,
  asOf: string,
): StudentResult {
  const relevant = entries.filter((entry) => entry.date <= asOf);
  const marksOf = (type: LessonType) =>
    relevant
      .filter((entry) => entry.mark && typeOf(entry.date) == type)
      .map((entry) => getMarkValue(entry.mark!));
  const examMarks = marksOf("exam");
  const projectMarks = marksOf("project");
  const symbols = relevant.filter(
    (entry) => getGradeDefinition(entry.grade)?.value != null,
  );

  const oral = getOralAverage(symbols);
  const project = average(projectMarks);
  const exam = average(examMarks);
  const assessments = symbols.length + examMarks.length + projectMarks.length;
  return {
    oral,
    project,
    exam,
    total:
      assessments < MIN_ASSESSMENTS
        ? null
        : combine(exam, combine(project, oral, PROJECT_SHARE), EXAM_SHARE),
  };
}

/**
 * Suggests the symbol for a student's lesson: the one closest to the weighted average of all
 * symbols before that date, or the neutral symbol without any.
 */
export function suggestGrade(entries: GradeEntry[], date: string): GradeKey {
  const average = getOralAverage(entries.filter((entry) => entry.date < date));
  if (average == null) return DEFAULT_GRADE_TOOL;
  const distance = (value: number | null) => Math.abs(value! - average);
  return GRADES.filter((grade) => grade.value != null).reduce((best, grade) =>
    distance(grade.value) < distance(best.value) ? grade : best,
  ).key;
}

/** Formats a grade with one decimal, e.g. "2,4"; `null` is shown as `fallback`. */
export const formatGrade = (value: number | null, fallback = "–") =>
  value == null ? fallback : value.toFixed(1).replace(".", ",");
