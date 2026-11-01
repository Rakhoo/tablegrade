import type { LessonType } from "./grades";
import type { ReportColumn } from "./reports";

/** A column of the overview with the oral grades or marks of a lesson. */
export type LessonColumn = { date: string; kind: "oral" | "mark" };

/** A column of the overview. */
export type OverviewColumn = LessonColumn | ReportColumn;

/**
 * Lessons take one column each; projects two, as marks stand apart from the oral grades.
 * The columns of a date's reports follow its lesson.
 */
export const getOverviewColumns = (
  dates: string[],
  typeOf: (date: string) => LessonType,
  reportColumns: ReportColumn[],
): OverviewColumn[] =>
  dates.flatMap((date): OverviewColumn[] => {
    const type = typeOf(date);
    const lesson: LessonColumn[] =
      type == "exam"
        ? [{ date, kind: "mark" }]
        : type == "project"
          ? [
              { date, kind: "oral" },
              { date, kind: "mark" },
            ]
          : [{ date, kind: "oral" }];
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
