import {
  getDuties,
  getSchoolClasses,
  getTraits,
  waitForDatabase,
} from "../../db";

/** Loads what the settings need to know about the existing data. */
export async function settingsLoader() {
  await waitForDatabase();
  const [schoolClasses, traits, duties] = await Promise.all([
    getSchoolClasses(),
    getTraits(),
    getDuties(),
  ]);
  return { schoolClasses, traits, duties };
}

export type SettingsLoaderData = Awaited<ReturnType<typeof settingsLoader>>;
