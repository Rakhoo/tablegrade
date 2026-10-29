import { db } from "../client";
import { holidays, type Holiday } from "../schema";

/** Returns all cached holidays. */
export const getHolidays = () => db.select().from(holidays);

/** Stores holidays, keeping already cached entries. */
export async function insertHolidays(entries: Holiday[]) {
  if (entries.length > 0)
    await db.insert(holidays).values(entries).onConflictDoNothing();
}
