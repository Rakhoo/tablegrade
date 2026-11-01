import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type AppSettings } from "../../lib/settings";
import { db } from "../client";
import {
  schoolYears,
  settings,
  traits,
  studentTraits,
  type Trait,
} from "../schema";

/** Returns all settings, unset ones with their default value. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      rows.map(({ key, value }) => [key, JSON.parse(value)]),
    ),
  };
}

/** Saves the given settings. */
export async function saveSettings(changes: Partial<AppSettings>) {
  for (const [key, value] of Object.entries(changes)) {
    const json = JSON.stringify(value);
    await db
      .insert(settings)
      .values({ key, value: json })
      .onConflictDoUpdate({ target: settings.key, set: { value: json } });
  }
}

/** Returns the school years in use, oldest first. */
export const getSchoolYears = () =>
  db.select().from(schoolYears).orderBy(schoolYears.year);

/** Adds a school year or changes the start of its second half. */
export async function saveSchoolYear(year: number, secondHalfStart: string) {
  await db
    .insert(schoolYears)
    .values({ year, secondHalfStart })
    .onConflictDoUpdate({
      target: schoolYears.year,
      set: { secondHalfStart },
    });
}

/** Removes a school year. */
export const deleteSchoolYear = (year: number) =>
  db.delete(schoolYears).where(eq(schoolYears.year, year));

/** Adds a trait or changes its name and color. */
export async function saveTrait({
  id,
  ...values
}: Omit<Trait, "id"> & { id?: number }) {
  if (id) await db.update(traits).set(values).where(eq(traits.id, id));
  else await db.insert(traits).values(values);
}

/** Deletes a trait; students lose it through the cascade. */
export const deleteTrait = (id: number) =>
  db.delete(traits).where(eq(traits.id, id));

/** Counts how many students have a trait. */
export async function countTraitUses(id: number) {
  const rows = await db
    .select()
    .from(studentTraits)
    .where(eq(studentTraits.traitId, id));
  return rows.length;
}
