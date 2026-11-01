import {
  getCancelledDays,
  getCancelledLessons,
  getCompletedLessons,
  getLessonTypes,
  getSchoolClasses,
  getSchoolYears,
  getSettings,
  waitForDatabase,
} from "../../db";
import { createCalendar } from "../../lib/schoolYear";
import { loadHolidays } from "../../services/holidays";

/** Loads the calendar (refreshing holidays from the API if needed), classes and lesson states. */
export async function timetableLoader() {
  await waitForDatabase();
  const [settings, schoolYears] = await Promise.all([
    getSettings(),
    getSchoolYears(),
  ]);
  const [
    holidays,
    cancelledDays,
    cancelledLessons,
    completedLessons,
    lessonTypes,
    schoolClasses,
  ] = await Promise.all([
    loadHolidays(
      settings,
      schoolYears.map(({ year }) => year),
    ),
    getCancelledDays(),
    getCancelledLessons(),
    getCompletedLessons(),
    getLessonTypes(),
    getSchoolClasses(),
  ]);
  return {
    calendar: createCalendar(holidays, schoolYears),
    cancelledDays,
    cancelledLessons,
    completedLessons,
    lessonTypes,
    schoolClasses,
  };
}

export type TimetableLoaderData = Awaited<ReturnType<typeof timetableLoader>>;
