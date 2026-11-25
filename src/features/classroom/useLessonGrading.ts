import type { GradeEntry, SeatedStudent } from "../../db";
import type { EditHistory } from "../../hooks/useEditHistory";
import { useSettings } from "../../hooks/useSettings";
import { suggestGrade } from "../../lib/assessment";
import { formatStudentName } from "../../lib/formatters";
import {
  describeValues,
  getToolValues,
  type GradeTarget,
} from "../../lib/gradeTools";
import {
  getValidGradeTool,
  isExamDay,
  MARK_KIND,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { createMarkRules } from "../../lib/lessonChains";
import { getVisibleGrades } from "../../lib/settings";
import { WARNING_LEVELS } from "../../lib/warnings";

type LessonGradingOptions = {
  students: SeatedStudent[];
  /** Entries of this lesson. */
  grades: GradeEntry[];
  /** Entries of all lessons of the class, for suggestions and the mark rules. */
  classGrades: GradeEntry[];
  date: string;
  lessonTypes: LessonType[];
  /** Types of all lessons of the class, by date. */
  classLessonTypes: Record<string, LessonType[]>;
  /** Whether the grading mode is on; suggestions and grayed students only show then. */
  grading: boolean;
  tool: GradeTool;
  /** The mark a mark tool sets when the lesson has a retake and a project. */
  markTarget: GradeTarget;
  history: EditHistory;
  /** Whether the class shows its grades as points, for the undo history. */
  points: boolean;
  /** Asks which grade to erase, for a student with several in the lesson. */
  onEraseChoice: (choice: {
    student: SeatedStudent;
    parts: GradeTarget[];
  }) => void;
};

/**
 * Grading and warning in one lesson of the seating plan: the valid tool, the mark rules,
 * suggestions, students the tool cannot grade, and the changes recorded in the undo history.
 */
export function useLessonGrading({
  students,
  grades,
  classGrades,
  date,
  lessonTypes,
  classLessonTypes,
  grading,
  tool,
  markTarget,
  history,
  points,
  onEraseChoice,
}: LessonGradingOptions) {
  const settings = useSettings();
  const gradeMap = new Map(grades.map((entry) => [entry.studentId, entry]));
  const visibleGrades = getVisibleGrades(settings);
  const activeTool = getValidGradeTool(
    tool,
    lessonTypes,
    visibleGrades,
    settings.suggestions,
  );
  const examDay = isExamDay(lessonTypes);
  const hasRetake = lessonTypes.includes("retake");
  const hasProject = lessonTypes.some((type) => MARK_KIND[type] == "project");
  // The marks set by mark tools; with a retake and a project on one day the switch decides
  const markField: GradeTarget =
    hasRetake && hasProject ? markTarget : hasRetake ? "mark" : "projectMark";
  const rules = createMarkRules(
    Object.keys(classLessonTypes),
    (day) => classLessonTypes[day] ?? [],
    students.map((student) => student.id),
    classGrades,
  );
  const isRetaker = (studentId: string) => rules.isRetaker(studentId, date);

  /** The part of a student's entry a tool sets, `undefined` for erasing everything. */
  const targetOf = (
    studentId: string,
    option: GradeTool,
  ): GradeTarget | undefined => {
    if (option == "erase") return undefined;
    if (option.startsWith("mark:")) return markField;
    if (option == "absent" && isRetaker(studentId)) return "mark";
    return "oral";
  };
  /** Whether a tool cannot be used on a student: graded elsewhere, or a retaker's oral grade. */
  const isClosed = (studentId: string, option: GradeTool) => {
    const target = targetOf(studentId, option);
    return !!target && rules.isClosed(studentId, date, target);
  };
  const closedStudents = new Set(
    grading
      ? students
          .filter((student) => isClosed(student.id, activeTool))
          .map((student) => student.id)
      : [],
  );

  // While grading, students without a symbol show what their previous ones suggest
  const suggestions = new Map(
    grading && !examDay && settings.suggestions
      ? students
          .filter((student) => {
            const entry = gradeMap.get(student.id);
            return (
              entry?.grade == null && !entry?.absent && !isRetaker(student.id)
            );
          })
          .map((student) => [
            student.id,
            suggestGrade(
              classGrades.filter((entry) => entry.studentId == student.id),
              date,
              visibleGrades,
            ),
          ])
      : [],
  );

  /** The parts of a student's entry holding a grade; none on exam days, which have only one. */
  const filledParts = (studentId: string): GradeTarget[] => {
    const entry = gradeMap.get(studentId);
    if (!entry || examDay) return [];
    const retaker = isRetaker(studentId);
    const parts: GradeTarget[] = [];
    if (entry.grade != null || (entry.absent && !retaker)) parts.push("oral");
    if (entry.projectMark != null) parts.push("projectMark");
    if (entry.mark != null || (entry.absent && retaker)) parts.push("mark");
    return parts;
  };

  /** Applies a grading tool to a student's entry, recorded in the undo history. */
  const applyTool = async (
    student: SeatedStudent,
    option: GradeTool,
    target: GradeTarget | undefined,
  ) => {
    const values = getToolValues(option, lessonTypes, target);
    if (!values) return;
    await history.change(
      "Bewertung",
      student.id,
      date,
      gradeMap.get(student.id),
      values,
      `${formatStudentName(student)}: ${describeValues(values, points)}`,
    );
  };

  /** Sets the warning level of a student, recorded in the undo history. */
  const setWarnings = async (student: SeatedStudent, level: number) => {
    const warnings = gradeMap.get(student.id)?.warnings ?? 0;
    if (level == warnings) return;
    await history.changeWarnings(
      student.id,
      date,
      warnings,
      level,
      `${formatStudentName(student)}: ${WARNING_LEVELS[level]?.label ?? "Normal"}`,
    );
  };

  /**
   * Grades a student with a tool; the suggestion takes the student's suggested symbol.
   * @param target The field a mark sets, if chosen with the mark; otherwise as the tool decides.
   */
  const gradeStudent = async (
    student: SeatedStudent,
    chosen: GradeTool,
    target?: GradeTarget,
  ) => {
    const field = target ?? targetOf(student.id, chosen);
    if (field && rules.isClosed(student.id, date, field)) return;
    const suggestion = suggestions.get(student.id);
    const option: GradeTool | null =
      chosen != "suggestion"
        ? chosen
        : suggestion == null
          ? null
          : `grade:${suggestion}`;
    if (!option) return;
    // With several grades, erasing asks which one goes
    const parts = option == "erase" ? filledParts(student.id) : [];
    if (parts.length > 1) onEraseChoice({ student, parts });
    else await applyTool(student, option, field);
  };

  return {
    /** Entries of this lesson by student id. */
    gradeMap,
    activeTool,
    markField,
    rules,
    closedStudents,
    suggestions,
    applyTool,
    gradeStudent,
    setWarnings,
  };
}
