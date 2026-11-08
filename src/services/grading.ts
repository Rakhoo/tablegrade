import type { GradeEntry } from "../db";
import {
  FAIL_GRADE,
  formatMark,
  isExamDay,
  MARK_KIND,
  getToolValue,
  type GradeTool,
  type LessonType,
} from "../lib/grades";

/** The parts of a student's entry that can be changed while grading. */
export type EntryValues = Pick<
  GradeEntry,
  "grade" | "mark" | "projectMark" | "absent" | "comment"
>;

/** What a tap grades in a lesson: its oral grade, its exam or retake mark or its project mark. */
export type GradeTarget = "oral" | "mark" | "projectMark";

/**
 * Returns what a grading tool (all but the suggestion) changes on an entry, if it fits the
 * lesson: an exam takes marks and "excused", other lessons oral grades and the marks of their
 * retake or project.
 * @param target The part tapped, e.g. a column of the overview; marks need one. Without one
 *   erasing removes everything.
 */
export function getToolValues(
  tool: GradeTool,
  types: LessonType[],
  target?: GradeTarget,
): Partial<EntryValues> | null {
  if (tool == "suggestion") return null;
  const examDay = isExamDay(types);
  if (tool == "erase") {
    if (examDay) return { grade: null, mark: null, absent: false };
    if (target == "mark") return { mark: null, absent: false };
    if (target == "projectMark") return { projectMark: null };
    if (target == "oral") return { grade: null, absent: false };
    return { grade: null, mark: null, projectMark: null, absent: false };
  }
  if (tool == "absent") {
    if (examDay || target == "mark")
      return { absent: true, grade: null, mark: null };
    return { absent: true, grade: null };
  }
  if (tool.startsWith("mark:")) {
    const mark = getToolValue(tool);
    if (examDay) return { mark, absent: false };
    if (target == "mark" && types.includes("retake"))
      return { mark, absent: false };
    if (
      target == "projectMark" &&
      types.some((type) => MARK_KIND[type] == "project")
    )
      return { projectMark: mark };
    return null;
  }
  if (examDay || target == "mark" || target == "projectMark") return null;
  return { grade: getToolValue(tool), absent: false };
}

/** Short text of what a change of an entry sets, for the undo history. */
export function describeValues(values: Partial<EntryValues>) {
  if (values.absent) return "abwesend";
  if (values.grade != null) return formatMark(values.grade);
  if (values.mark != null) return `Note ${formatMark(values.mark)}`;
  if (values.projectMark != null)
    return `Projektnote ${formatMark(values.projectMark)}`;
  return "gelöscht";
}

/** The tool for sanctioning a student in a cancelled lesson. */
export const FAIL_TOOL: GradeTool = `grade:${FAIL_GRADE}`;
