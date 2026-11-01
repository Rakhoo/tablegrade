import type { GradeEntry } from "../db";
import {
  FAIL_GRADE,
  getToolValue,
  type GradeTool,
  type LessonType,
} from "../lib/grades";

/** The parts of a student's entry that can be changed while grading. */
export type EntryValues = Pick<
  GradeEntry,
  "grade" | "mark" | "absent" | "comment"
>;

/**
 * Returns what a grading tool (all but comment and suggestion) changes on an entry, if it fits
 * the lesson type: exams take marks and "excused", regular lessons grades, projects both.
 */
export function getToolValues(
  tool: GradeTool,
  type: LessonType,
): Partial<EntryValues> | null {
  if (tool == "comment" || tool == "suggestion") return null;
  if (tool == "erase") {
    return type == "exam"
      ? { grade: null, mark: null, absent: false }
      : { grade: null, absent: false };
  }
  if (tool == "eraseMark") return type == "normal" ? null : { mark: null };
  if (tool == "absent") {
    return type == "exam"
      ? { absent: true, grade: null, mark: null }
      : { absent: true, grade: null };
  }
  if (tool.startsWith("mark:")) {
    const mark = getToolValue(tool);
    if (type == "normal") return null;
    return type == "exam" ? { mark, absent: false } : { mark };
  }
  return type == "exam" ? null : { grade: getToolValue(tool), absent: false };
}

/** The tool for sanctioning a student in a cancelled lesson. */
export const FAIL_TOOL: GradeTool = `grade:${FAIL_GRADE}`;
