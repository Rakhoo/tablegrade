import { isValid, parseISO } from "date-fns";
import { redirect, type LoaderFunctionArgs } from "react-router";
import {
  getCancelledDays,
  getClassStudents,
  getGrades,
  getHolidays,
  getSchoolClass,
  getSchoolClasses,
  getSubjects,
  waitForDatabase,
  type GradeEntry,
  type SchoolClass,
  type SeatedStudent,
} from "../../db";
import { getLastOccurrence, toIsoDate } from "../../lib/dates";
import { getAdjacentLesson, type Lesson } from "../../lib/lessons";

/** How the classroom page was opened: creating, viewing or editing a class. */
export type ClassroomMode = "new" | "view" | "edit";

/**
 * Loads a class with students and the grades of the selected lesson date.
 * The date comes from `?date=` and defaults to the most recent lesson of the class.
 */
export async function classroomLoader(
  { params, request }: LoaderFunctionArgs,
  mode: ClassroomMode,
) {
  const isNew = mode == "new";
  await waitForDatabase();

  const dateParam = parseISO(
    new URL(request.url).searchParams.get("date") ?? "",
  );
  const [holidays, cancelledDays, allClasses, subjects] = await Promise.all([
    getHolidays(),
    getCancelledDays(),
    getSchoolClasses(),
    getSubjects(),
  ]);
  const base = {
    holidays,
    allClasses,
    subjects,
    editing: mode != "view",
  };

  if (isNew) {
    return {
      ...base,
      class: undefined as SchoolClass | undefined,
      students: [] as SeatedStudent[],
      grades: [] as GradeEntry[],
      date: toIsoDate(isValid(dateParam) ? dateParam : new Date()),
      previous: null as Lesson | null,
      next: null as Lesson | null,
    };
  }

  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect("/404");
  const date = toIsoDate(
    isValid(dateParam) ? dateParam : getLastOccurrence(cls.day),
  );
  const [students, grades] = await Promise.all([
    getClassStudents(cls.id),
    getGrades(cls.id, date),
  ]);
  const lessonDate = parseISO(date);
  return {
    ...base,
    class: cls as SchoolClass | undefined,
    students,
    grades,
    date,
    previous: getAdjacentLesson(
      cls,
      lessonDate,
      allClasses,
      holidays,
      cancelledDays,
      -1,
    ),
    next: getAdjacentLesson(
      cls,
      lessonDate,
      allClasses,
      holidays,
      cancelledDays,
      1,
    ),
  };
}

export type ClassroomLoaderData = Exclude<
  Awaited<ReturnType<typeof classroomLoader>>,
  Response
>;
