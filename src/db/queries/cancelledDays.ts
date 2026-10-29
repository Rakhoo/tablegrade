import { eq } from "drizzle-orm";
import { client, db } from "../client";
import { cancelledDays, grades } from "../schema";

/** Returns the dates (`YYYY-MM-DD`) of all days marked as cancelled. */
export async function getCancelledDays() {
  const rows = await db.select().from(cancelledDays);
  return rows.map((row) => row.date);
}

/** Counts the grade entries (symbols, comments, warnings) of all classes on a date. */
export async function countEntriesOn(date: string) {
  const rows = await db
    .select({ classId: grades.classId })
    .from(grades)
    .where(eq(grades.date, date));
  return {
    entries: rows.length,
    classes: new Set(rows.map((row) => row.classId)).size,
  };
}

/**
 * Marks a day as cancelled ("Ausfall") or as a regular school day again.
 * Cancelling deletes all grade entries of that day, as nothing is graded on cancelled days.
 */
export async function setDayCancelled(date: string, cancelled: boolean) {
  if (!cancelled) {
    await db.delete(cancelledDays).where(eq(cancelledDays.date, date));
    return;
  }
  await client.transaction(async (tx) => {
    await tx.query(db.delete(grades).where(eq(grades.date, date)));
    await tx.query(
      db.insert(cancelledDays).values({ date }).onConflictDoNothing(),
    );
  });
}
