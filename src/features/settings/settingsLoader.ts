import { getSchoolClasses, getTraits, waitForDatabase } from "../../db";

/** Loads what the settings need to know about the existing data. */
export async function settingsLoader() {
  await waitForDatabase();
  const [schoolClasses, traits] = await Promise.all([
    getSchoolClasses(),
    getTraits(),
  ]);
  return { schoolClasses, traits };
}

export type SettingsLoaderData = Awaited<ReturnType<typeof settingsLoader>>;
