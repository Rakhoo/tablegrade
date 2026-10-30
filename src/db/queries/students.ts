import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";
import { seatsOverlap } from "../../lib/seating";
import { client, db } from "../client";
import {
  classStudents,
  students,
  studentTraits,
  traits,
  type Student,
} from "../schema";

/** A student with the seat in a specific class and the ids of the assigned traits. */
export type SeatedStudent = Student & {
  x: number | null;
  y: number | null;
  traitIds: number[];
};

/** Returns all selectable traits, sorted alphabetically (ignoring case). */
export async function getTraits() {
  const rows = await db.select().from(traits);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Returns all students of a class with seats and traits, ordered by name. */
export async function getClassStudents(
  classId: number,
): Promise<SeatedStudent[]> {
  const members = await db
    .select({
      ...getTableColumns(students),
      x: classStudents.x,
      y: classStudents.y,
    })
    .from(classStudents)
    .innerJoin(students, eq(students.id, classStudents.studentId))
    .where(eq(classStudents.classId, classId))
    .orderBy(asc(students.lastName), asc(students.firstName));
  const assigned = await db
    .select()
    .from(studentTraits)
    .where(
      inArray(
        studentTraits.studentId,
        members.map((member) => member.id),
      ),
    );
  return members.map((member) => ({
    ...member,
    traitIds: assigned
      .filter((entry) => entry.studentId == member.id)
      .map((entry) => entry.traitId),
  }));
}

/** Removes students that are no longer part of any class. */
export const deleteOrphanStudents = () =>
  client.sql(
    "DELETE FROM Students WHERE id NOT IN (SELECT studentId FROM Classes2Students)",
  );

/**
 * Moves a student so its top left cell is at `(x, y)`. If the new place overlaps exactly
 * one other student, both swap their places; overlapping several students does nothing.
 */
export async function moveStudentSeat(
  classId: number,
  studentId: number,
  x: number,
  y: number,
) {
  const members = await getClassStudents(classId);
  const mover = members.find((s) => s.id == studentId);
  const overlapped = members.filter(
    (s) => s.id != studentId && seatsOverlap(s, { x, y }),
  );
  if (!mover || overlapped.length > 1) return;
  const occupant = overlapped[0];
  // A swap moves the mover exactly onto the occupant's place
  if (occupant) ({ x, y } = occupant as { x: number; y: number });

  const seatOf = (sid: number) =>
    and(eq(classStudents.classId, classId), eq(classStudents.studentId, sid));
  await client.transaction(async (tx) => {
    if (occupant) {
      await tx.query(
        db
          .update(classStudents)
          .set({ x: mover.x, y: mover.y })
          .where(seatOf(occupant.id)),
      );
    }
    await tx.query(
      db.update(classStudents).set({ x, y }).where(seatOf(studentId)),
    );
  });
}
