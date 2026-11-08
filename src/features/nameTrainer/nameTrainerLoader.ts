import { redirect, type LoaderFunctionArgs } from "react-router";
import { paths } from "../../lib/paths";
import { getClassStudents, getSchoolClass, waitForDatabase } from "../../db";

/** Loads a class and its visible students with a photo for the name cards. */
export async function nameTrainerLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  await waitForDatabase();
  const cls = await getSchoolClass(Number(params.id));
  if (!cls) return redirect(paths.notFound());
  const students = await getClassStudents(cls.id);
  return {
    class: cls,
    students: students.filter((student) => !student.hidden && student.image),
    date: new URL(request.url).searchParams.get("date"),
  };
}

export type NameTrainerLoaderData = Exclude<
  Awaited<ReturnType<typeof nameTrainerLoader>>,
  Response
>;
