import { isValid, parseISO } from "date-fns";
import { redirect, type LoaderFunctionArgs } from "react-router";
import {
  getCancelledDays,
  getCancelledLessons,
  getClassGrades,
  getClassStudents,
  getGrades,
  getLessonTypes,
  getSchoolYears,
  getHolidays,
  getSchoolClass,
  getSchoolClasses,
  getTraits,
  waitForDatabase,
} from "../../db";
import { getLastOccurrence, toIsoDate } from "../../lib/dates";
import { createCalendar, getClassOccurrences } from "../../lib/schoolYear";
import type { LessonType } from "../../lib/grades";
import { getAdjacentLesson, lessonKey } from "../../lib/lessons";

/**
 * Loads a class with students and the grades of the selected lesson date.
 * The date comes from `?date=` and defaults to the most recent lesson of the class.
 */
export async function classroomLoader({ params, request }: LoaderFunctionArgs) {
  await waitForDatabase();
  const dateParam = parseISO(
    new URL(request.url).searchParams.get("date") ?? "",
  );
  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect("/404");
  const [
    holidays,
    schoolYears,
    cancelledDays,
    cancelledLessons,
    allClasses,
    traits,
  ] = await Promise.all([
    getHolidays(),
    getSchoolYears(),
    getCancelledDays(),
    getCancelledLessons(),
    getSchoolClasses(),
    getTraits(),
  ]);
  const calendar = createCalendar(holidays, schoolYears);
  const date = toIsoDate(
    isValid(dateParam)
      ? dateParam
      : getClassOccurrences(cls)
          .map((lesson) => getLastOccurrence(lesson.day))
          .sort((a, b) => b.getTime() - a.getTime())[0],
  );
  const [roster, grades, classGrades, lessonTypes] = await Promise.all([
    getClassStudents(cls.id),
    getGrades(cls.id, date),
    getClassGrades(cls.id),
    getLessonTypes(),
  ]);
  const lessonDate = parseISO(date);
  const cancelled = { days: cancelledDays, lessons: cancelledLessons };
  return {
    class: cls,
    students: roster.filter((student) => !student.hidden),
    // All students, also hidden ones, to restore their seats when a move is undone
    roster,
    traits,
    grades,
    classGrades,
    date,
    lessonType: (lessonTypes[lessonKey(cls.id, date)] ??
      "normal") as LessonType,
    previous: getAdjacentLesson(
      cls,
      lessonDate,
      allClasses,
      calendar,
      cancelled,
      -1,
    ),
    next: getAdjacentLesson(
      cls,
      lessonDate,
      allClasses,
      calendar,
      cancelled,
      1,
    ),
  };
}

export type ClassroomLoaderData = Exclude<
  Awaited<ReturnType<typeof classroomLoader>>,
  Response
>;
