import { and, eq } from "drizzle-orm";
import { lessonKey } from "../../lib/lessons";
import { client, db } from "../client";
import { cancelledDays, cancelledLessons, grades } from "../schema";

/** Returns the dates (`YYYY-MM-DD`) of all days marked as cancelled. */
export async function getCancelledDays() {
  const rows = await db.select().from(cancelledDays);
  return rows.map((row) => row.date);
}

/** Returns the keys (see `lessonKey`) of all single lessons marked as cancelled. */
export async function getCancelledLessons() {
  const rows = await db.select().from(cancelledLessons);
  return rows.map((row) => lessonKey(row.classId, row.date));
}

/** Counts the grade entries (symbols, comments, warnings) on a date, optionally of one class. */
export async function countEntriesOn(date: string, classId?: number) {
  const rows = await db
    .select({ classId: grades.classId })
    .from(grades)
    .where(
      and(
        eq(grades.date, date),
        classId ? eq(grades.classId, classId) : undefined,
      ),
    );
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

/**
 * Marks a single lesson as cancelled ("Ausfall") or as regular again.
 * Cancelling deletes the grade entries of that lesson.
 */
export async function setLessonCancelled(
  classId: number,
  date: string,
  cancelled: boolean,
) {
  const lesson = and(
    eq(cancelledLessons.classId, classId),
    eq(cancelledLessons.date, date),
  );
  if (!cancelled) {
    await db.delete(cancelledLessons).where(lesson);
    return;
  }
  await client.transaction(async (tx) => {
    await tx.query(
      db
        .delete(grades)
        .where(and(eq(grades.classId, classId), eq(grades.date, date))),
    );
    await tx.query(
      db
        .insert(cancelledLessons)
        .values({ classId, date })
        .onConflictDoNothing(),
    );
  });
}
