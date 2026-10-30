import { redirect, type LoaderFunctionArgs } from "react-router";
import {
  getCancelledDays,
  getCancelledLessons,
  getClassGrades,
  getClassStudents,
  getHolidays,
  getSchoolClass,
  getSchoolClasses,
  waitForDatabase,
} from "../../db";
import { compareStudents } from "../../lib/formatters";
import { getLessonDates } from "../../lib/lessons";

/** Loads all classes for the selection page. */
export async function evaluationsLoader() {
  await waitForDatabase();
  return { schoolClasses: await getSchoolClasses() };
}

/**
 * Loads a class with its students (sorted by "Vorname Nachname"), all grade entries and the
 * table columns: the lesson dates so far plus any later or irregular date with entries.
 */
export async function evaluationLoader({ params }: LoaderFunctionArgs) {
  await waitForDatabase();
  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect("/404");
  const [students, entries, holidays, days, lessons] = await Promise.all([
    getClassStudents(cls.id),
    getClassGrades(cls.id),
    getHolidays(),
    getCancelledDays(),
    getCancelledLessons(),
  ]);
  const lessonDates = getLessonDates(cls, holidays, { days, lessons });
  return {
    class: cls,
    students: students.sort(compareStudents),
    entries,
    dates: [
      ...new Set([...lessonDates, ...entries.map((entry) => entry.date)]),
    ].sort(),
  };
}

export type EvaluationsLoaderData = Awaited<
  ReturnType<typeof evaluationsLoader>
>;
export type EvaluationLoaderData = Exclude<
  Awaited<ReturnType<typeof evaluationLoader>>,
  Response
>;
