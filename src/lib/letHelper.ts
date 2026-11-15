import type { GradeEntry, SchoolClass } from "../db";
import { getStudentResult, type GradingRules } from "./assessment";
import { formatClassName } from "./formatters";
import { formatMark, MARK_FIELD, type MarkKind } from "./grades";
import { getLessonChains, type TypesOf } from "./lessonChains";
import {
  roundGrade,
  sortReports,
  type Report,
  type ReportOverride,
} from "./reports";
import {
  byText,
  mergeLetCourse,
  type LetFile,
  type LetFileCourse,
} from "./letMerge";
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
  /** Report grades set by hand, replacing the calculated ones. */
  reportGrades: ReportOverride[];
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
  /** Whether the exams are exported; without them they are left out of `solei` as well. */
  includeExams: boolean;
  /** Whether the projects are exported; without them they are left out of `solei` as well. */
  includeProjects: boolean;
  basis: LetBasis;
  /** Id of the course of a loaded file to merge into; `null` adds a new course. */
  target: string | null;
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

/** A grade written as a mark ("2+"), or empty without one. */
const writeGrade = (value: number | null) =>
  value == null ? "" : formatMark(value);

/** Short school year of a class, e.g. "26-27" for 2026/27. */
export const getLetSchoolYear = (year: number) =>
  `${String(year % 100).padStart(2, "0")}-${String((year + 1) % 100).padStart(2, "0")}`;

/** Which exams and projects of a course are exported, and what `solei` is then. */
export type LetMarkSelection = {
  /** Kinds whose marks are left out, also of the calculation. */
  ignored: Record<MarkKind, boolean>;
  /**
   * What `solei` holds: the oral grade next to all marks; the calculated grade without the
   * left out kind; the grade set by hand (else calculated) once no marks are exported at all.
   */
  solei: "oral" | "total" | "report";
};

/** The exported kinds of marks of a course and what its `solei` holds. */
export function getLetMarkSelection(
  choice: LetCourseChoice,
  columns: LetMarkColumn[],
): LetMarkSelection {
  const exists = (kind: MarkKind) =>
    columns.some((column) => column.kind == kind);
  const ignored = {
    exam: !choice.includeExams,
    project: !choice.includeProjects,
  };
  const exported = (["exam", "project"] as const).some(
    (kind) => exists(kind) && !ignored[kind],
  );
  const skipped = (["exam", "project"] as const).some(
    (kind) => exists(kind) && ignored[kind],
  );
  return {
    ignored,
    solei: !exported ? "report" : skipped ? "total" : "oral",
  };
}

/** The course of one class in the export file. */
function buildCourse(
  choice: LetCourseChoice,
  letNr: number,
  rules: GradingRules,
  now: string,
): LetFileCourse {
  const { data, basis } = choice;
  const period = getPeriod(data.reports, basis);
  const allColumns = getLetMarkColumns(data, basis);
  const { ignored, solei } = getLetMarkSelection(choice, allColumns);
  const columns = allColumns
    .filter((column) => !ignored[column.kind])
    .map((column) => ({
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
        // Left out kinds count as if there had been none
        const entries = data.entries
          .filter(
            (entry) =>
              entry.studentId == student.id && entry.date > period.from,
          )
          .map((entry) => ({
            ...entry,
            mark: ignored.exam ? null : entry.mark,
            projectMark: ignored.project ? null : entry.projectMark,
          }));
        const result = getStudentResult(entries, period.to, rules);
        const override =
          basis.kind == "report"
            ? data.reportGrades.find(
                (grade) =>
                  grade.studentId == student.id &&
                  grade.date == basis.report.date &&
                  grade.kind == basis.report.kind,
              )?.grade
            : undefined;
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
            solei == "oral"
              ? roundGrade(result.oral)
              : solei == "total"
                ? roundGrade(result.total)
                : (override ?? roundGrade(result.total)),
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
 * exams and projects of the chosen period, unless left out, and `solei` (see `LetMarkSelection`),
 * written as marks ("2+").
 * The school year is the one of the first course. With an `existing` file the courses are
 * merged into the chosen ones of it (see `mergeLetCourse`), all else in it stays.
 * @returns The file name and its JSON content.
 */
export function buildLetExport(
  initials: string,
  letNr: 1 | 2,
  courses: LetCourseChoice[],
  rules: GradingRules,
  existing: LetFile | null = null,
  now = new Date(),
) {
  const schoolYear = getLetSchoolYear(courses[0].data.cls.year);
  const exported = now.toISOString();
  const built = courses.map((choice) => ({
    target: existing ? choice.target : null,
    course: buildCourse(choice, letNr, rules, exported),
  }));
  const merged = (existing?.courses ?? []).map((course) => {
    const update = built.find(({ target }) => target == course.id);
    return update ? mergeLetCourse(course, update.course, exported) : course;
  });
  const added = built.flatMap(({ target, course }) =>
    target == null ? [course] : [],
  );
  const existingLet = existing?.let as Record<string, unknown> | undefined;
  const content = {
    ...existing,
    app: "elternsprechtag-helfer",
    schema: 2,
    exported,
    kuerzel: initials,
    gruppe: `LET${letNr}_${schoolYear}`,
    let: { ...existingLet, letNr, sj: schoolYear },
    courses: [...merged, ...added].sort(
      byText((course) => `${course.name} ${course.fach}`),
    ),
  };
  return {
    fileName: `${initials}_LET${letNr}_${schoolYear}.json`,
    json: JSON.stringify(content, null, 2),
  };
}
