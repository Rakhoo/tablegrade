import type { GradeEntry } from "../db";
import { getStudentResult, type GradingRules } from "./assessment";
import { GRADE_VALUES, type LessonType } from "./grades";

/** A grade given for a period: part of the school year half ("Teilnote") or all of it. */
export type ReportKind = "partial" | "half";

/** Display names of the report kinds. */
export const REPORT_LABELS: Record<ReportKind, string> = {
  partial: "Teilnote",
  half: "Halbjahresnote",
};

/** A report of a class on a date. */
export type Report = { date: string; kind: ReportKind };

/** A grade set by hand, replacing the calculated one. */
export type ReportOverride = Report & { studentId: number; grade: number };

/** A column of a report: a read-only part of it or, if `main`, the editable grade itself. */
export type ReportColumn = {
  kind: "report";
  date: string;
  report: ReportKind;
  label: string;
  main: boolean;
  /** Number of columns of this report on its first column, otherwise 0. */
  groupSize: number;
  /** Shown grades by student id; `null` if there is none. */
  values: Map<number, number | null>;
  /** Calculated grades by student id, which `values` of the main column may override. */
  suggestions: Map<number, number | null>;
};

/** Rounds a calculated grade to the closest grade with tendency. */
export const getNearestGrade = (value: number) =>
  GRADE_VALUES.reduce((best, grade) =>
    Math.abs(grade - value) < Math.abs(best - value) ? grade : best,
  );

const roundGrade = (value: number | null) =>
  value == null ? null : getNearestGrade(value);

/** Reports by date; on the same day the partial comes before the half. */
const sortReports = (reports: Report[]) =>
  [...reports].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(a.kind == "half") - Number(b.kind == "half"),
  );

/**
 * Calculates the columns of all reports. A report covers the entries since the previous one;
 * a half after partials consists of these partials instead, and uses their average.
 * @param studentIds The students to calculate grades for.
 * @param entries The entries of the class.
 * @param typeOf Returns the type of the lesson on a date.
 */
export function getReportColumns(
  reports: Report[],
  overrides: ReportOverride[],
  studentIds: number[],
  entries: GradeEntry[],
  typeOf: (date: string) => LessonType,
  rules: GradingRules,
) {
  const columns: ReportColumn[] = [];
  const partials: ReportColumn[] = [];
  let coveredUntil = "";

  for (const { date, kind } of sortReports(reports)) {
    const base = { kind: "report" as const, date, report: kind, groupSize: 0 };
    const toMap = (getValue: (studentId: number) => number | null) =>
      new Map(studentIds.map((id) => [id, getValue(id)]));
    let parts: ReportColumn[];
    let suggestions: Map<number, number | null>;

    if (kind == "half" && partials.length > 0) {
      parts = partials.map((partial, index) => ({
        ...partial,
        ...base,
        label: `${index + 1}. Teil`,
        main: false,
      }));
      suggestions = toMap((id) => {
        const values = partials.flatMap(
          (partial) => partial.values.get(id) ?? [],
        );
        return values.length > 0
          ? getNearestGrade(
              values.reduce((sum, value) => sum + value, 0) / values.length,
            )
          : null;
      });
    } else {
      const results = new Map(
        studentIds.map((id) => [
          id,
          getStudentResult(
            entries.filter(
              (entry) => entry.studentId == id && entry.date > coveredUntil,
            ),
            typeOf,
            date,
            rules,
          ),
        ]),
      );
      const getPart = (label: string, part: "oral" | "project" | "exam") => {
        const values = toMap((id) => roundGrade(results.get(id)![part]));
        return { ...base, label, main: false, values, suggestions: values };
      };
      parts = [
        getPart("Mündlich", "oral"),
        getPart("Projekte", "project"),
        getPart("Klausuren", "exam"),
      ].filter(({ values }) =>
        [...values.values()].some((value) => value != null),
      );
      suggestions = toMap((id) => roundGrade(results.get(id)!.total));
      coveredUntil = date;
    }

    const main: ReportColumn = {
      ...base,
      label: "Gesamt",
      main: true,
      suggestions,
      values: toMap(
        (id) =>
          overrides.find(
            (override) =>
              override.date == date &&
              override.kind == kind &&
              override.studentId == id,
          )?.grade ??
          suggestions.get(id) ??
          null,
      ),
    };
    if (kind == "partial") partials.push(main);
    const group = [...parts, main];
    group[0] = { ...group[0], groupSize: group.length };
    columns.push(...group);
  }
  return columns;
}

/**
 * Checks adding or removing a report: there is one half at most, based either on no partial
 * or on at least two.
 * @returns The reason against the change, or `null` if it is fine.
 */
export function getReportChangeError(reports: Report[], report: Report) {
  const isSame = ({ date, kind }: Report) =>
    date == report.date && kind == report.kind;
  const exists = reports.some(isSame);
  if (!exists && report.kind == "half" && reports.some((r) => r.kind == "half"))
    return "Es gibt bereits eine Halbjahresnote.";
  const next = exists
    ? reports.filter((other) => !isSame(other))
    : [...reports, report];
  const half = next.find(({ kind }) => kind == "half");
  const partials = next.filter(
    ({ date, kind }) => kind == "partial" && half && date <= half.date,
  );
  if (partials.length != 1) return null;
  return report.kind == "half"
    ? "Es gibt erst eine Teilnote. Zuerst muss eine zweite erstellt werden."
    : "Die Halbjahresnote braucht mindestens zwei Teilnoten oder gar keine.";
}
