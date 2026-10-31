import {
  getCancelledDays,
  getCancelledLessons,
  getCompletedLessons,
  getLessonTypes,
  getSchoolClasses,
  waitForDatabase,
} from "../../db";
import { loadHolidays } from "../../services/holidays";

/** Loads holidays (refreshing them from the API if needed), classes and the lesson states. */
export async function timetableLoader() {
  await waitForDatabase();
  const [
    holidays,
    cancelledDays,
    cancelledLessons,
    completedLessons,
    lessonTypes,
    schoolClasses,
  ] = await Promise.all([
    loadHolidays(),
    getCancelledDays(),
    getCancelledLessons(),
    getCompletedLessons(),
    getLessonTypes(),
    getSchoolClasses(),
  ]);
  return {
    holidays,
    cancelledDays,
    cancelledLessons,
    completedLessons,
    lessonTypes,
    schoolClasses,
  };
}

export type TimetableLoaderData = Awaited<ReturnType<typeof timetableLoader>>;
