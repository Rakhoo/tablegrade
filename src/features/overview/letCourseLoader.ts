import {
  getClassGrades,
  getClassStudents,
  getHolidays,
  getLessonTypes,
  getReports,
  getSchoolYears,
  type SchoolClass,
} from "../../db";
import type { LetCourseData } from "../../lib/letHelper";
import { getLessonDates, lessonKey } from "../../lib/lessons";
import { createCalendar } from "../../lib/schoolYear";

/**
 * Loads what the "LET-Helfer" export needs of another class than the shown one: its visible
 * students, entries, reports and lesson dates so far, like the overview does.
 */
export async function loadLetCourse(cls: SchoolClass): Promise<LetCourseData> {
  const [students, entries, reports, lessonTypes, holidays, schoolYears] =
    await Promise.all([
      getClassStudents(cls.id),
      getClassGrades(cls.id),
      getReports(cls.id),
      getLessonTypes(),
      getHolidays(),
      getSchoolYears(),
    ]);
  const calendar = createCalendar(holidays, schoolYears);
  const lessonDates = getLessonDates(cls, calendar, { days: [], lessons: [] });
  return {
    cls,
    students: students.filter((student) => !student.hidden),
    entries,
    reports,
    dates: [
      ...new Set([
        ...lessonDates,
        ...entries.map((entry) => entry.date),
        ...reports.map((report) => report.date),
      ]),
    ].sort(),
    typesOf: (date) => lessonTypes[lessonKey(cls.id, date)] ?? [],
  };
}
