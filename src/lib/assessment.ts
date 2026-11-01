import type { GradeEntry } from "../db";
import { DEFAULT_GRADE, type LessonType } from "./grades";
import type { AppSettings } from "./settings";

/** The settings the calculation depends on. */
type GradingRules = Pick<
  AppSettings,
  "examShare" | "projectShare" | "recency" | "minAssessments"
>;

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

/** Weight of the grade at `index` (oldest first) for suggestions: 1, 2, 3 … */
const getSuggestionWeight = (index: number) => index + 1;

/**
 * Weighted average of the symbols, where `getWeight` gets a symbol's position (oldest first)
 * and their number. "Excused" and missing entries are not part of it.
 */
function getOralAverage(
  entries: GradeEntry[],
  getWeight: (index: number, total: number) => number,
) {
  const values = entries
    .filter((entry) => entry.grade != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => entry.grade!);
  if (values.length == 0) return null;
  const weights = values.map((_, index) => getWeight(index, values.length));
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
 * Calculates a student's result from all entries up to `asOf` (`YYYY-MM-DD`): exams against
 * the rest, which splits into projects and oral participation, all shares from the rules.
 * @param entries The entries of one student in one class.
 * @param typeOf Returns the type of the lesson on a date.
 */
export function getStudentResult(
  entries: GradeEntry[],
  typeOf: (date: string) => LessonType,
  asOf: string,
  rules: GradingRules,
): StudentResult {
  const relevant = entries.filter((entry) => entry.date <= asOf);
  const marksOf = (type: LessonType) =>
    relevant
      .filter((entry) => entry.mark != null && typeOf(entry.date) == type)
      .map((entry) => entry.mark!);
  const examMarks = marksOf("exam");
  const projectMarks = marksOf("project");
  const grades = relevant.filter((entry) => entry.grade != null);

  // The newest grade counts `recency` times as much as the oldest, evenly rising in between
  const oral = getOralAverage(grades, (index, total) =>
    total > 1 ? 1 + ((rules.recency - 1) * index) / (total - 1) : 1,
  );
  const project = average(projectMarks);
  const exam = average(examMarks);
  const assessments = grades.length + examMarks.length + projectMarks.length;
  return {
    oral,
    project,
    exam,
    total:
      assessments < rules.minAssessments
        ? null
        : combine(
            exam,
            combine(project, oral, rules.projectShare),
            rules.examShare,
          ),
  };
}

/**
 * Suggests the grade for a student's lesson: the offered one closest to the weighted average
 * of all grades before that date, or the neutral grade without any.
 */
export function suggestGrade(
  entries: GradeEntry[],
  date: string,
  visibleGrades: number[],
) {
  const average =
    getOralAverage(
      entries.filter((entry) => entry.date < date),
      getSuggestionWeight,
    ) ?? DEFAULT_GRADE;
  return visibleGrades.reduce((best, grade) =>
    Math.abs(grade - average) < Math.abs(best - average) ? grade : best,
  );
}

/** Formats a grade with one decimal, e.g. "2,4"; `null` is shown as `fallback`. */
export const formatGrade = (value: number | null, fallback = "–") =>
  value == null ? fallback : value.toFixed(1).replace(".", ",");
