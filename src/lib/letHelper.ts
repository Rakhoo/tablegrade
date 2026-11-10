import type { GradeEntry, SchoolClass } from "../db";
import { getStudentResult, type GradingRules } from "./assessment";
import { formatClassName } from "./formatters";
import { formatMark, MARK_FIELD, type MarkKind } from "./grades";
import { getLessonChains, type TypesOf } from "./lessonChains";
import { roundGrade, sortReports, type Report } from "./reports";
import { getDistinguishingInitials } from "./studentRoster";

/** What the grades of a course are taken from: a report or the state on a lesson date. */
export type LetBasis =
  { kind: "report"; report: Report } | { kind: "date"; date: string };

/** The data of a class the export needs. */
export type LetCourseData = {
  cls: SchoolClass;
  students: { firstName: string; lastName: string; id: number }[];
  entries: GradeEntry[];
  reports: Report[];
  /** Lesson dates of the class so far, plus dates with entries or reports. */
  dates: string[];
  typesOf: TypesOf;
};

/** The choices made for one course in the export dialog. */
export type LetCourseChoice = {
  data: LetCourseData;
  subject: string;
  examPrefix: string;
  projectPrefix: string;
  basis: LetBasis;
};

/** An exam or project of a period, with its follow-ups. */
export type LetMarkColumn = {
  kind: MarkKind;
  /** Position among all exams or projects of the class, starting at 1. */
  number: number;
  /** Its dates inside the period, oldest first. */
  dates: string[];
};

/** Entries after `from` up to and including `to` (`YYYY-MM-DD`; `from` may be empty). */
type Period = { from: string; to: string };

const inPeriod = (date: string, { from, to }: Period) =>
  date > from && date <= to;

/**
 * The period a basis covers, like a report: since the previous report. A half based on partials
 * covers all of them; a date counts as a partial on that day.
 */
function getPeriod(reports: Report[], basis: LetBasis): Period {
  if (basis.kind == "date") {
    const previous = sortReports(reports)
      .filter((report) => report.date < basis.date)
      .at(-1);
    return { from: previous?.date ?? "", to: basis.date };
  }
  const sorted = sortReports(reports);
  const index = sorted.findIndex(
    ({ date, kind }) => date == basis.report.date && kind == basis.report.kind,
  );
  const before = sorted.slice(0, Math.max(index, 0));
  const from =
    basis.report.kind == "half" && before.some((r) => r.kind == "partial")
      ? ""
      : (before.at(-1)?.date ?? "");
  return { from, to: basis.report.date };
}

/** A student's mark of `kind` on one of `dates`, or `null`. */
const findMark = (
  entries: GradeEntry[],
  kind: MarkKind,
  studentId: number,
  dates: string[],
) =>
  entries.find(
    (entry) =>
      entry.studentId == studentId &&
      dates.includes(entry.date) &&
      entry[MARK_FIELD[kind]] != null,
  )?.[MARK_FIELD[kind]] ?? null;

/**
 * The exams and projects starting in a basis's period that have at least one mark there,
 * exams first, each by date.
 */
export function getLetMarkColumns(
  data: LetCourseData,
  basis: LetBasis,
): LetMarkColumn[] {
  const period = getPeriod(data.reports, basis);
  const chains = getLessonChains(data.dates, data.typesOf);
  return (["exam", "project"] as const).flatMap((kind) =>
    [...new Set(chains[kind].values())]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .flatMap((chain, index) => {
        const dates = chain.filter((date) => inPeriod(date, period));
        const hasMarks =
          inPeriod(chain[0], period) &&
          data.students.some(
            (student) =>
              findMark(data.entries, kind, student.id, dates) != null,
          );
        return hasMarks ? [{ kind, number: index + 1, dates }] : [];
      }),
  );
}

/** Compares items alphabetically by a text, numbers by value ("5a" before "10a"). */
const byText =
  <Item>(getText: (item: Item) => string) =>
  (a: Item, b: Item) =>
    getText(a).localeCompare(getText(b), "de", { numeric: true });

/** A grade written as a mark ("2+"), or empty without one. */
const writeGrade = (value: number | null) =>
  value == null ? "" : formatMark(value);

/** Short school year of a class, e.g. "26-27" for 2026/27. */
export const getLetSchoolYear = (year: number) =>
  `${String(year % 100).padStart(2, "0")}-${String((year + 1) % 100).padStart(2, "0")}`;

/** The course of one class in the export file. */
function buildCourse(
  choice: LetCourseChoice,
  letNr: number,
  rules: GradingRules,
  now: string,
) {
  const { data, basis } = choice;
  const period = getPeriod(data.reports, basis);
  const columns = getLetMarkColumns(data, basis).map((column) => ({
    ...column,
    id: crypto.randomUUID(),
    type: column.kind == "exam" ? "KA" : "Test",
    label: `${column.kind == "exam" ? choice.examPrefix : choice.projectPrefix} ${column.number}`,
  }));
  const initials = getDistinguishingInitials(data.students);
  return {
    id: crypto.randomUUID(),
    name: formatClassName(data.cls),
    fach: choice.subject.trim(),
    layout: "eigen",
    letNr,
    sj: getLetSchoolYear(data.cls.year),
    noten: "noten",
    kuerzel: "",
    columns: columns.map(({ id, type, label }) => ({ id, type, label })),
    students: data.students
      .map((student, index) => {
        const entries = data.entries.filter(
          (entry) => entry.studentId == student.id && entry.date > period.from,
        );
        return {
          id: crypto.randomUUID(),
          vorname: student.firstName.trim(),
          initiale: initials[index],
          grades: Object.fromEntries(
            columns.map((column) => [
              column.id,
              writeGrade(
                findMark(data.entries, column.kind, student.id, column.dates),
              ),
            ]),
          ),
          solei: writeGrade(
            roundGrade(getStudentResult(entries, period.to, rules).oral),
          ),
          bem: "",
          scales: {},
          lob: [],
          lobEigen: "",
          tip: [],
          tipEigen: "",
          done: false,
        };
      })
      .sort(byText((student) => `${student.vorname} ${student.initiale}`)),
    created: now,
    updated: now,
    lastFileSave: now,
  };
}

/**
 * Builds the file for the "LET-Helfer" of the TMG Ahlen (parent-teacher days): per course its
 * exams and projects of the chosen period and the oral grade, written as marks ("2+").
 * The school year is the one of the first course.
 * @returns The file name and its JSON content.
 */
export function buildLetExport(
  initials: string,
  letNr: 1 | 2,
  courses: LetCourseChoice[],
  rules: GradingRules,
  now = new Date(),
) {
  const schoolYear = getLetSchoolYear(courses[0].data.cls.year);
  const exported = now.toISOString();
  const content = {
    app: "elternsprechtag-helfer",
    schema: 2,
    exported,
    kuerzel: initials,
    gruppe: `LET${letNr}_${schoolYear}`,
    let: { letNr, sj: schoolYear },
    courses: courses
      .map((choice) => buildCourse(choice, letNr, rules, exported))
      .sort(byText((course) => `${course.name} ${course.fach}`)),
  };
  return {
    fileName: `${initials}_LET${letNr}_${schoolYear}.json`,
    json: JSON.stringify(content, null, 2),
  };
}
