import { getSchoolClasses, waitForDatabase } from "../../db";

/** Loads all classes for the class list. */
export async function classListLoader() {
  await waitForDatabase();
  return { schoolClasses: await getSchoolClasses() };
}

export type ClassListLoaderData = Awaited<ReturnType<typeof classListLoader>>;
