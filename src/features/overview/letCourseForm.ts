import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { toIsoDate } from "../../lib/dates";
import type {
  LetBasis,
  LetCourseChoice,
  LetCourseData,
} from "../../lib/letHelper";
import { sortReports, type Report } from "../../lib/reports";

/** A course in the dialog: its choices, with the basis split into the two kinds' selections. */
export type CourseForm = Omit<LetCourseChoice, "basis"> & {
  basisKind: LetBasis["kind"];
  /** Selected report as `reportKey`. */
  report: string;
  /** Selected lesson date. */
  date: string;
};

/** Key of a report within a class. */
export const reportKey = ({ date, kind }: Report) => `${date}|${kind}`;

/** Readable date, e.g. "Mo, 10.11.2026". */
export const formatDay = (date: string) =>
  format(parseISO(date), "EEEEEE, dd.MM.yyyy", { locale: de });

/** Lesson dates up to today, newest first; today if there is none yet. */
export function getDateOptions(data: LetCourseData) {
  const today = toIsoDate(new Date());
  const past = data.dates.filter((date) => date <= today).reverse();
  return past.length > 0 ? past : [today];
}

/** Defaults of a course: its subject, the latest report or else the latest lesson, a new course. */
export function createForm(data: LetCourseData): CourseForm {
  const latestReport = sortReports(data.reports).at(-1);
  return {
    data,
    subject: data.cls.subject,
    examPrefix: "KA",
    projectPrefix: "Projekt",
    includeExams: true,
    includeProjects: true,
    basisKind: latestReport ? "report" : "date",
    report: latestReport ? reportKey(latestReport) : "",
    date: getDateOptions(data)[0],
    target: null,
  };
}

/** The basis selected in a course form. */
export function getBasis(form: CourseForm): LetBasis {
  const report = form.data.reports.find((r) => reportKey(r) == form.report);
  return form.basisKind == "report" && report
    ? { kind: "report", report }
    : { kind: "date", date: form.date };
}
