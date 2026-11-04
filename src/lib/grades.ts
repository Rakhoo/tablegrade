import { mixColors } from "./colors";

/** Kind of a lesson: a regular one, an exam ("Klausur") or one with a project. */
export type LessonType = "normal" | "exam" | "project";

/**
 * All grades as stored and calculated, from best to worst: a tendency is worth 0.3, so "2+"
 * is 1.7 and "2-" is 2.3. There is no "1+".
 */
export const GRADE_VALUES = [
  1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 4.3, 4.7, 5, 5.3, 5.7, 6,
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
  | `grade:${number}`
  | `mark:${number}`
  | "absent"
  | "erase"
  | "eraseMark"
  | "suggestion";

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
  const lower = Math.min(Math.floor(value), 5);
  return mixColors(GRADE_COLORS[lower - 1], GRADE_COLORS[lower], value - lower);
}

/** Color of the "excused" symbol. */
export const ABSENT_COLOR = "#9ca3af";

type EntryState = {
  grade: number | null;
  mark: number | null;
  absent: boolean;
};

/** Whether a lesson counts as complete for a student: exams need a mark or "excused". */
export const isEntryComplete = (
  entry: EntryState | undefined,
  type: LessonType,
) =>
  !!entry &&
  (entry.absent || (type == "exam" ? entry.mark : entry.grade) != null);

/** The tools available for a lesson type; without a type all of them (overview table). */
export function getGradeTools(visibleGrades: number[], type?: LessonType) {
  const grades: GradeTool[] =
    type == "exam"
      ? []
      : visibleGrades.map((grade) => `grade:${grade}` as const);
  const marks: GradeTool[] =
    type == "normal"
      ? []
      : [
          ...GRADE_VALUES.map((mark) => `mark:${mark}` as const),
          ...(type == "exam" ? [] : (["eraseMark"] as const)),
        ];
  return { grades, marks };
}

/** Keeps a tool if it fits the lesson type, otherwise returns the type's neutral default. */
export function getValidGradeTool(
  tool: GradeTool,
  type: LessonType,
  visibleGrades: number[],
  suggestions: boolean,
): GradeTool {
  const { grades, marks } = getGradeTools(visibleGrades, type);
  const others: GradeTool[] = ["absent", "erase"];
  if (suggestions && type != "exam") others.push("suggestion");
  if ([...grades, ...marks, ...others].includes(tool)) return tool;
  if (type == "exam") return `mark:${DEFAULT_GRADE}`;
  // Without the suggestion the offered symbol closest to the neutral grade
  return visibleGrades.length > 0
    ? `grade:${getNearestGrade(DEFAULT_GRADE, visibleGrades)}`
    : `grade:${DEFAULT_GRADE}`;
}
