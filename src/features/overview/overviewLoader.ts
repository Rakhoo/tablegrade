import { redirect, type LoaderFunctionArgs } from "react-router";
import {
  getCancelledDays,
  getCancelledLessons,
  getClassGrades,
  getClassStudents,
  getHolidays,
  getLessonTypes,
  getReportGrades,
  getReports,
  getSchoolYears,
  getSchoolClass,
  getSchoolClasses,
  getTraits,
  waitForDatabase,
} from "../../db";
import { getLessonDates } from "../../lib/lessons";
import { createCalendar } from "../../lib/schoolYear";

/** Loads all classes for the selection page. */
export async function overviewListLoader() {
  await waitForDatabase();
  return { schoolClasses: await getSchoolClasses() };
}

/**
 * Loads a class with its students, all grade entries, the lesson states and the table
 * columns: the lesson dates so far plus any later or irregular date with entries.
 */
export async function overviewLoader({ params }: LoaderFunctionArgs) {
  await waitForDatabase();
  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect("/404");
  const [
    students,
    entries,
    holidays,
    schoolYears,
    days,
    lessons,
    lessonTypes,
    traits,
    reports,
    reportGrades,
  ] = await Promise.all([
    getClassStudents(cls.id),
    getClassGrades(cls.id),
    getHolidays(),
    getSchoolYears(),
    getCancelledDays(),
    getCancelledLessons(),
    getLessonTypes(),
    getTraits(),
    getReports(cls.id),
    getReportGrades(cls.id),
  ]);
  const calendar = createCalendar(holidays, schoolYears);
  // Cancelled lessons and days stay as grayed columns, e.g. for sanctions or to restore them
  const lessonDates = getLessonDates(cls, calendar, { days: [], lessons: [] });
  return {
    class: cls,
    students: students.filter((student) => !student.hidden),
    entries,
    days,
    lessons,
    lessonTypes,
    traits,
    reports,
    reportGrades,
    dates: [
      ...new Set([
        ...lessonDates,
        ...entries.map((entry) => entry.date),
        ...reports.map((report) => report.date),
      ]),
    ].sort(),
  };
}

export type OverviewListLoaderData = Awaited<
  ReturnType<typeof overviewListLoader>
>;
export type OverviewLoaderData = Exclude<
  Awaited<ReturnType<typeof overviewLoader>>,
  Response
>;
