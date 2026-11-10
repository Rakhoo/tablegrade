import { redirect, type LoaderFunctionArgs } from "react-router";
import { formatClassName } from "../../lib/formatters";
import { paths } from "../../lib/paths";
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
  type SchoolClass,
} from "../../db";
import { parseISO } from "date-fns";
import {
  getAdjacentLesson,
  getLessonDates,
  getUpcomingLessonDate,
} from "../../lib/lessons";
import { toIsoDate } from "../../lib/dates";
import { createCalendar } from "../../lib/schoolYear";

/** Whether two classes take place in the same school year half (a whole year overlaps both). */
const isSameHalf = (a: SchoolClass, b: SchoolClass) =>
  a.year == b.year &&
  (a.part == b.part || a.part == "full" || b.part == "full");

/**
 * Loads a class with its students, all grade entries, the lesson states and the table
 * columns: the lesson dates up to today or the table's lesson (`?date=`, else today's or the
 * next one), whichever is later, plus any later or irregular date with entries.
 */
export async function overviewLoader({ params, request }: LoaderFunctionArgs) {
  await waitForDatabase();
  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect(paths.notFound());
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
    allClasses,
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
    getSchoolClasses(),
  ]);
  const calendar = createCalendar(holidays, schoolYears);
  // Cancelled lessons and days stay as grayed columns, e.g. for sanctions or to restore them
  const allLessons = { days: [], lessons: [] };
  const pastDates = getLessonDates(cls, calendar, allLessons);
  const cancelled = { days, lessons };
  const seatingDate =
    getUpcomingLessonDate(cls, calendar, cancelled) ?? pastDates.at(-1) ?? null;
  // The lesson the table belongs to, for the previous and next lesson in the timetable
  const lessonDate =
    new URL(request.url).searchParams.get("date") ?? seatingDate;
  // The lessons so far, up to the table's lesson if that is still to come
  const lessonDates =
    lessonDate && lessonDate > toIsoDate(new Date())
      ? getLessonDates(cls, calendar, allLessons, parseISO(lessonDate))
      : pastDates;
  const adjacent = (direction: 1 | -1) =>
    lessonDate
      ? getAdjacentLesson(
          cls,
          parseISO(lessonDate),
          allClasses,
          calendar,
          cancelled,
          direction,
        )
      : null;
  return {
    class: cls,
    students: students.filter((student) => !student.hidden),
    /** The lesson the seating plan opens with: today's or the next one, else the last one. */
    seatingDate,
    previous: adjacent(-1),
    next: adjacent(1),
    entries,
    days,
    lessons,
    lessonTypes,
    traits,
    reports,
    reportGrades,
    /** Other classes of the same school year half, for exporting them together. */
    sameHalfClasses: allClasses
      .filter((other) => other.id != cls.id && isSameHalf(cls, other))
      .sort(
        (a, b) =>
          formatClassName(a).localeCompare(formatClassName(b), "de", {
            numeric: true,
          }) || a.subject.localeCompare(b.subject, "de"),
      ),
    dates: [
      ...new Set([
        ...lessonDates,
        ...entries.map((entry) => entry.date),
        ...reports.map((report) => report.date),
      ]),
    ].sort(),
  };
}

export type OverviewLoaderData = Exclude<
  Awaited<ReturnType<typeof overviewLoader>>,
  Response
>;
