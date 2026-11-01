import { db } from "../client";
import { holidays, type Holiday } from "../schema";

/** Returns all cached holidays. */
export const getHolidays = () => db.select().from(holidays);

/** Replaces the cached holidays. */
export async function replaceHolidays(entries: Holiday[]) {
  await db.delete(holidays);
  if (entries.length > 0) {
    await db.insert(holidays).values(entries).onConflictDoNothing();
  }
}
