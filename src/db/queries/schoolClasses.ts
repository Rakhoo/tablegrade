import { and, asc, eq, inArray } from "drizzle-orm";
import { freeSeats, type Seat } from "../../lib/seating";
import { client, db } from "../client";
import {
  classStudents,
  grades,
  schoolClasses,
  students,
  studentTraits,
  type SchoolClass,
} from "../schema";
import { deleteOrphanStudents, getClassStudents } from "./students";

export type SchoolClassInput = Omit<SchoolClass, "id"> & { id?: number };
/** A roster entry from the edit dialog; entries without `id` are new students. */
export type RosterEntry = {
  id?: number;
  firstName: string;
  lastName: string;
  nickname: string | null;
  image: string | null;
  traitIds: number[];
};

/** Returns all classes, ordered by weekday and lesson. */
export const getSchoolClasses = () =>
  db
    .select()
    .from(schoolClasses)
    .orderBy(asc(schoolClasses.day), asc(schoolClasses.hour));

/** Returns a single class or `undefined`. */
export async function getSchoolClass(id: number) {
  const [cls] = await db
    .select()
    .from(schoolClasses)
    .where(eq(schoolClasses.id, id));
  return cls as SchoolClass | undefined;
}

/** Returns all distinct subject names, for autocompletion. */
export async function getSubjects() {
  const rows = await db
    .selectDistinct({ subject: schoolClasses.subject })
    .from(schoolClasses)
    .orderBy(asc(schoolClasses.subject));
  return rows.map((row) => row.subject);
}

/**
 * Creates or updates a class and synchronizes its roster in one transaction.
 * New members are placed on the first free seats; grades of removed members are deleted.
 * @returns The id of the saved class.
 */
export async function saveSchoolClass(
  data: SchoolClassInput,
  roster: RosterEntry[],
) {
  const { id, ...values } = data;
  const existing = id ? await getClassStudents(id) : [];
  const keptIds = new Set(
    roster.flatMap((entry) => (entry.id ? [entry.id] : [])),
  );
  const removedIds = existing
    .map((s) => s.id)
    .filter((sid) => !keptIds.has(sid));

  const occupied: Seat[] = existing.filter((s) => keptIds.has(s.id));
  const seats = freeSeats(occupied);

  const classId = await client.transaction(async (tx) => {
    let classId = id;
    if (classId) {
      await tx.query(
        db
          .update(schoolClasses)
          .set(values)
          .where(eq(schoolClasses.id, classId)),
      );
    } else {
      const [row] = await tx.query(
        db
          .insert(schoolClasses)
          .values(values)
          .returning({ id: schoolClasses.id }),
      );
      classId = row.id as number;
    }

    if (removedIds.length > 0) {
      const removed = and(
        eq(classStudents.classId, classId),
        inArray(classStudents.studentId, removedIds),
      );
      await tx.query(db.delete(classStudents).where(removed));
      await tx.query(
        db
          .delete(grades)
          .where(
            and(
              eq(grades.classId, classId),
              inArray(grades.studentId, removedIds),
            ),
          ),
      );
    }

    const memberIds = new Set(existing.map((s) => s.id));
    for (const entry of roster) {
      const { id: entryId, traitIds, ...fields } = entry;
      let studentId = entryId;
      if (studentId) {
        await tx.query(
          db.update(students).set(fields).where(eq(students.id, studentId)),
        );
        await tx.query(
          db
            .delete(studentTraits)
            .where(eq(studentTraits.studentId, studentId)),
        );
      } else {
        const [row] = await tx.query(
          db.insert(students).values(fields).returning({ id: students.id }),
        );
        studentId = row.id as number;
      }
      for (const traitId of traitIds) {
        await tx.query(db.insert(studentTraits).values({ studentId, traitId }));
      }
      if (!memberIds.has(studentId)) {
        const seat = seats.next().value ?? { x: null, y: null };
        await tx.query(
          db.insert(classStudents).values({ classId, studentId, ...seat }),
        );
      }
    }
    return classId;
  });

  if (removedIds.length > 0) await deleteOrphanStudents();
  return classId;
}

/** Deletes a class including its memberships and grades. */
export async function deleteSchoolClass(id: number) {
  await db.delete(schoolClasses).where(eq(schoolClasses.id, id));
  await deleteOrphanStudents();
}
