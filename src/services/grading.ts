import { setAssessment } from "../db";
import {
  ABSENT_GRADE,
  type GradeTool,
  type LessonType,
  type Mark,
} from "../lib/grades";

/**
 * Applies a grading tool (all but the comment) to a student, if it fits the lesson type:
 * exams take marks and "excused", regular lessons symbols, projects both.
 * @returns Whether the entry was changed.
 */
export async function applyGradeTool(
  tool: GradeTool,
  type: LessonType,
  classId: number,
  studentId: number,
  date: string,
) {
  const save = async (values: {
    grade?: string | null;
    mark?: string | null;
  }) => {
    await setAssessment(classId, studentId, date, values);
    return true;
  };
  if (tool == "comment") return false;
  if (tool == "erase") {
    return save(type == "exam" ? { grade: null, mark: null } : { grade: null });
  }
  if (tool == "eraseMark") return type != "normal" && save({ mark: null });
  if (tool.startsWith("mark:")) {
    const mark = tool.slice("mark:".length) as Mark;
    if (type == "normal") return false;
    return save(type == "exam" ? { mark, grade: null } : { mark });
  }
  if (tool == ABSENT_GRADE && type == "exam") {
    return save({ grade: tool, mark: null });
  }
  return type != "exam" && save({ grade: tool });
}
