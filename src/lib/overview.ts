import type { LessonType } from "./grades";

/** A column of the overview: oral grades or marks of a lesson. */
export type OverviewColumn = { date: string; kind: "oral" | "mark" };

/** Lessons take one column each; projects two, as marks stand apart from the oral grades. */
export const getOverviewColumns = (
  dates: string[],
  typeOf: (date: string) => LessonType,
): OverviewColumn[] =>
  dates.flatMap((date): OverviewColumn[] => {
    const type = typeOf(date);
    if (type == "exam") return [{ date, kind: "mark" }];
    if (type == "project") {
      return [
        { date, kind: "oral" },
        { date, kind: "mark" },
      ];
    }
    return [{ date, kind: "oral" }];
  });
