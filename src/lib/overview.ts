import { isExamDay, MARK_KIND } from "./grades";
import type { TypesOf } from "./lessonChains";
import type { ReportColumn } from "./reports";

/**
 * A column of the overview for a lesson: its oral grades, its exam or retake marks (`mark`) or
 * its project marks (`projectMark`).
 */
export type LessonColumn = {
  date: string;
  kind: "oral" | "mark" | "projectMark";
};

/** A column of the overview. */
export type OverviewColumn = LessonColumn | ReportColumn;

/**
 * An exam takes one column of marks; other lessons one of oral grades, followed by one for
 * retake marks and one for project marks if they have them. The columns of a date's reports
 * follow its lesson.
 */
export const getOverviewColumns = (
  dates: string[],
  typesOf: TypesOf,
  reportColumns: ReportColumn[],
): OverviewColumn[] =>
  dates.flatMap((date): OverviewColumn[] => {
    const types = typesOf(date);
    const lesson: LessonColumn[] = isExamDay(types)
      ? [{ date, kind: "mark" }]
      : [
          { date, kind: "oral" },
          ...(types.includes("retake")
            ? [{ date, kind: "mark" } as const]
            : []),
          ...(types.some((type) => MARK_KIND[type] == "project")
            ? [{ date, kind: "projectMark" } as const]
            : []),
        ];
    return [
      ...lesson,
      ...reportColumns.filter((column) => column.date == date),
    ];
  });

/** Key of a column, unique within the table. */
export const getColumnKey = (column: OverviewColumn) =>
  column.kind == "report"
    ? `${column.date}-${column.report}-${column.label}`
    : `${column.date}-${column.kind}`;
