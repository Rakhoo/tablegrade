import type { GradeEntry } from "../db";
import {
  ABSENT_GRADE,
  type GradeTool,
  type LessonType,
  type Mark,
} from "../lib/grades";

/** The parts of a student's entry that can be changed while grading. */
export type EntryValues = Pick<GradeEntry, "grade" | "mark" | "comment">;

/**
 * Returns what a grading tool (all but comment and suggestion) changes on an entry, if it fits
 * the lesson type: exams take marks and "excused", regular lessons symbols, projects both.
 */
export function getToolValues(
  tool: GradeTool,
  type: LessonType,
): Partial<EntryValues> | null {
  if (tool == "comment" || tool == "suggestion") return null;
  if (tool == "erase") {
    return type == "exam" ? { grade: null, mark: null } : { grade: null };
  }
  if (tool == "eraseMark") return type == "normal" ? null : { mark: null };
  if (tool.startsWith("mark:")) {
    const mark = tool.slice("mark:".length) as Mark;
    if (type == "normal") return null;
    return type == "exam" ? { mark, grade: null } : { mark };
  }
  if (tool == ABSENT_GRADE && type == "exam") {
    return { grade: tool, mark: null };
  }
  return type == "exam" ? null : { grade: tool };
}
