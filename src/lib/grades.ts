import { mixColors } from "./colors";

/**
 * Type of a special lesson: an exam ("Klausur"), a project, or a follow-up of the latest exam
 * or project for students without a mark yet: a retake ("Nachklausur") or an extension
 * ("Projektverlängerung"). A lesson has no type, only an exam, or any of the others, at most one
 * of project and extension. Regular lessons and all but exams take oral grades.
 */
export type LessonType = "exam" | "retake" | "project" | "extension";

/** The two kinds of marks: of exams with their retakes, and of projects with their extensions. */
export type MarkKind = "exam" | "project";

/** Which mark a lesson type takes. */
export const MARK_KIND: Record<LessonType, MarkKind> = {
  exam: "exam",
  retake: "exam",
  project: "project",
  extension: "project",
};

/** The entry field holding a kind of mark. */
export const MARK_FIELD = { exam: "mark", project: "projectMark" } as const;

/** Whether a lesson is an exam, which takes marks but no oral grades. */
export const isExamDay = (types: LessonType[]) => types.includes("exam");

/**
 * All grades as stored and calculated, from best to worst: a tendency is worth 0.3, so "2+"
 * is 1.7 and "2-" is 2.3; "1+" is 0.7. There is no "6+", so the scale matches the points.
 */
export const GRADE_VALUES = [
  0.7, 1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 4.3, 4.7, 5, 5.3, 6,
];

/** The whole grades, which are the ones offered by default. */
export const WHOLE_GRADES = [1, 2, 3, 4, 5, 6];

/** Neutral grade, used as default tool and as suggestion without any previous grades. */
export const DEFAULT_GRADE = 3;

/** The grade for skipping a cancelled lesson. */
export const FAIL_GRADE = 6;

/**
 * What a tap on a student does while grading: set an oral grade or a mark, mark as absent,
 * remove something or enter the suggested grade.
 */
export type GradeTool =
  `grade:${number}` | `mark:${number}` | "absent" | "erase" | "suggestion";

/** Default tool while grading: the suggestion, if offered for the lesson. */
export const DEFAULT_GRADE_TOOL: GradeTool = "suggestion";

/**
 * The grade of `grades` (from best to worst) closest to `value`; of two equally close ones the
 * better. Tendencies are no exact binary fractions, so "equally close" allows for rounding.
 */
export function getNearestGrade(value: number, grades: number[]) {
  return grades.reduce((best, grade) =>
    Math.abs(grade - value) < Math.abs(best - value) - 1e-9 ? grade : best,
  );
}

/** The value of a `grade:` or `mark:` tool. */
export const getToolValue = (tool: GradeTool) => Number(tool.split(":")[1]);

/** Formats a grade like a mark: "2+", "2" or "2-". */
export function formatMark(value: number) {
  const whole = Math.round(value);
  const tendency = Math.round((value - whole) * 10);
  return `${whole}${tendency < 0 ? "+" : tendency > 0 ? "-" : ""}`;
}

/**
 * A grade as points of the upper school, 15 ("1+") to 0 ("6"): three points per grade, one per
 * tendency. Old entries of the former "6+" (5.7) count as 0 as well.
 */
export const toPoints = (value: number) =>
  Math.min(15, Math.max(0, Math.round(17 - 3 * value)));

/**
 * Formats a grade for display: as points ("13") or as a mark ("1-"). Grades are always stored
 * and calculated as marks, points are only how they are shown.
 */
export const formatGrade = (value: number, points: boolean) =>
  points ? String(toPoints(value)) : formatMark(value);

const GRADE_COLORS = [
  "#15803d",
  "#65a30d",
  "#64748b",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
];

/** Color of a grade on the scale from green (1) to red (6), including the tendencies. */
export function getGradeColor(value: number) {
  // "1+" shares the color of the 1
  const grade = Math.max(value, 1);
  const lower = Math.min(Math.floor(grade), 5);
  return mixColors(GRADE_COLORS[lower - 1], GRADE_COLORS[lower], grade - lower);
}

/** Color of the "excused" symbol. */
export const ABSENT_COLOR = "#9ca3af";

/** The tools available for a lesson's types; without types all of them (overview table). */
export function getGradeTools(visibleGrades: number[], types?: LessonType[]) {
  const grades: GradeTool[] =
    types && isExamDay(types)
      ? []
      : visibleGrades.map((grade) => `grade:${grade}` as const);
  const marks: GradeTool[] =
    types && types.length == 0
      ? []
      : GRADE_VALUES.map((mark) => `mark:${mark}` as const);
  return { grades, marks };
}

/** Keeps a tool if it fits the lesson's types (all for none given), otherwise a neutral default. */
export function getValidGradeTool(
  tool: GradeTool,
  types: LessonType[] | undefined,
  visibleGrades: number[],
  suggestions: boolean,
): GradeTool {
  const { grades, marks } = getGradeTools(visibleGrades, types);
  const examDay = !!types && isExamDay(types);
  const others: GradeTool[] = ["absent", "erase"];
  if (suggestions && !examDay) others.push("suggestion");
  if ([...grades, ...marks, ...others].includes(tool)) return tool;
  if (examDay) return `mark:${DEFAULT_GRADE}`;
  // Without the suggestion the offered symbol closest to the neutral grade
  return visibleGrades.length > 0
    ? `grade:${getNearestGrade(DEFAULT_GRADE, visibleGrades)}`
    : `grade:${DEFAULT_GRADE}`;
}
