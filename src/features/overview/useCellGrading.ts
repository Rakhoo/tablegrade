import { format, parseISO } from "date-fns";
import type { GradeEntry, SeatedStudent } from "../../db";
import type { EditHistory } from "../../hooks/useEditHistory";
import { formatStudentName } from "../../lib/formatters";
import { describeValues, FAIL_TOOL, getToolValues } from "../../lib/gradeTools";
import {
  formatGrade,
  getToolValue,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import type { MarkRules } from "../../lib/lessonChains";
import type { LessonColumn } from "../../lib/overview";
import { REPORT_LABELS, type ReportColumn } from "../../lib/reports";
import type { OverviewLoaderData } from "./overviewLoader";

/** Name and date of a cell, for the undo history. */
export const describeCell = (student: SeatedStudent, date: string) =>
  `${formatStudentName(student)}, ${format(parseISO(date), "dd.MM.")}`;

type CellGradingOptions = {
  tool: GradeTool;
  rules: MarkRules;
  isCancelled: (date: string) => boolean;
  entryOf: (studentId: string, date: string) => GradeEntry | undefined;
  typesOf: (date: string) => LessonType[];
  suggestionFor: (student: SeatedStudent, date: string) => number;
  /** Report grades set by hand. */
  reportGrades: OverviewLoaderData["reportGrades"];
  history: EditHistory;
  /** Whether the class shows its grades as points, for the undo history. */
  points: boolean;
  /** Shows why a tap changed nothing. */
  onMessage: (message: string) => void;
};

/**
 * Grading in the overview table: a tap on a lesson cell applies the tool, a tap on a report's
 * grade sets or clears it; both are recorded in the undo history.
 */
export function useCellGrading({
  tool,
  rules,
  isCancelled,
  entryOf,
  typesOf,
  suggestionFor,
  reportGrades,
  history,
  points,
  onMessage,
}: CellGradingOptions) {
  /** Why the current tool cannot be used on a cell, `null` if it can. */
  const toolError = (student: SeatedStudent, { date, kind }: LessonColumn) => {
    if (tool != "erase" && rules.isClosed(student.id, date, kind)) {
      if (kind == "oral")
        return "Wer nachschreibt, bekommt in dieser Stunde keine mündliche Note.";
      if (kind == "projectMark" && rules.isRetaker(student.id, date))
        return "Wer nachschreibt, wird in dieser Stunde nicht für das Projekt bewertet.";
      return "Dieser Schüler hat seine Note für diese Klausur bzw. dieses Projekt an einem anderen Termin.";
    }
    if (isCancelled(date))
      return tool == FAIL_TOOL || tool == "erase"
        ? null
        : "Bei Ausfall kann nur die 6 vergeben oder gelöscht werden.";
    const fits =
      tool == "erase" ||
      (tool == "absent"
        ? kind != "projectMark"
        : tool.startsWith("mark:")
          ? kind != "oral"
          : kind == "oral");
    return fits ? null : "Dieses Werkzeug passt nicht zu dieser Spalte.";
  };

  /** Applies the tool to a lesson cell, or names why it cannot. */
  const gradeCell = async (student: SeatedStudent, column: LessonColumn) => {
    const { date, kind } = column;
    const error = toolError(student, column);
    if (error) return onMessage(error);
    const entry = entryOf(student.id, date);
    if (tool == "suggestion" && (entry?.grade != null || entry?.absent)) return;
    const values = getToolValues(
      tool == "suggestion" ? `grade:${suggestionFor(student, date)}` : tool,
      typesOf(date),
      kind,
    );
    if (!values)
      return onMessage("Dieses Werkzeug passt nicht zu dieser Stunde.");
    await history.change(
      "Bewertung",
      student.id,
      date,
      entry,
      values,
      `${describeCell(student, date)}: ${describeValues(values, points)}`,
    );
  };

  /** Tap on a report's grade: marks replace the calculated grade, erasing brings it back. */
  const gradeReport = async (
    student: SeatedStudent,
    { date, report: kind }: ReportColumn,
  ) => {
    if (!tool.startsWith("mark:") && tool != "erase")
      return onMessage("Hier können nur Noten gesetzt oder gelöscht werden.");
    const before =
      reportGrades.find(
        (grade) =>
          grade.date == date &&
          grade.kind == kind &&
          grade.studentId == student.id,
      )?.grade ?? null;
    const after = tool == "erase" ? null : getToolValue(tool);
    await history.changeReport(
      { date, kind },
      student.id,
      before,
      after,
      `${formatStudentName(student)}, ${REPORT_LABELS[kind]}: ${
        after == null ? "Vorschlag" : formatGrade(after, points)
      }`,
    );
  };

  return { gradeCell, gradeReport };
}
