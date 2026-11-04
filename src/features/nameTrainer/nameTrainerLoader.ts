import { redirect, type LoaderFunctionArgs } from "react-router";
import { getClassStudents, getSchoolClass, waitForDatabase } from "../../db";
import type { ClassOrigin } from "../../components/ClassSubPageLayout";

/** Loads a class and its visible students with a photo for the name cards. */
export async function nameTrainerLoader(
  { params, request }: LoaderFunctionArgs,
  origin: ClassOrigin,
) {
  await waitForDatabase();
  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect("/404");
  const students = await getClassStudents(cls.id);
  return {
    origin,
    class: cls,
    students: students.filter((student) => !student.hidden && student.image),
    date: new URL(request.url).searchParams.get("date"),
  };
}

export type NameTrainerLoaderData = Exclude<
  Awaited<ReturnType<typeof nameTrainerLoader>>,
  Response
>;
