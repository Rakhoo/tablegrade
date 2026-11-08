import { redirect, type LoaderFunctionArgs } from "react-router";
import { paths } from "../../lib/paths";
import {
  getClassStudents,
  getHolidays,
  getSchoolClass,
  getSchoolClasses,
  getSchoolYears,
  getSubjects,
  getTraits,
  waitForDatabase,
  type SchoolClass,
  type SeatedStudent,
} from "../../db";
import { createCalendar } from "../../lib/schoolYear";

/**
 * Loads what the class editor needs: the class with all its students (also hidden ones), or
 * nothing for a new class, plus the other classes, subjects, calendar, school years and traits.
 */
export async function classEditLoader({ params, request }: LoaderFunctionArgs) {
  await waitForDatabase();
  const [holidays, schoolYears, allClasses, subjects, traits] =
    await Promise.all([
      getHolidays(),
      getSchoolYears(),
      getSchoolClasses(),
      getSubjects(),
      getTraits(),
    ]);
  let cls: SchoolClass | undefined;
  let roster: SeatedStudent[] = [];
  if (params.id) {
    cls = await getSchoolClass(Number(params.id));
    if (!cls) return redirect(paths.notFound());
    roster = await getClassStudents(cls.id);
  }
  return {
    class: cls,
    roster,
    allClasses,
    subjects,
    calendar: createCalendar(holidays, schoolYears),
    schoolYears,
    traits,
    date: new URL(request.url).searchParams.get("date"),
  };
}

export type ClassEditLoaderData = Exclude<
  Awaited<ReturnType<typeof classEditLoader>>,
  Response
>;
