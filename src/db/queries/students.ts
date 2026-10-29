import { and, asc, eq, getTableColumns } from "drizzle-orm";
import { seatsOverlap } from "../../lib/seating";
import { client, db } from "../client";
import { classStudents, students, type Student } from "../schema";

/** A student together with the seat in a specific class. */
export type SeatedStudent = Student & {
  x: number | null;
  y: number | null;
};

/** Returns all students of a class with their seats, ordered by name. */
export function getClassStudents(classId: number): Promise<SeatedStudent[]> {
  return db
    .select({
      ...getTableColumns(students),
      x: classStudents.x,
      y: classStudents.y,
    })
    .from(classStudents)
    .innerJoin(students, eq(students.id, classStudents.studentId))
    .where(eq(classStudents.classId, classId))
    .orderBy(asc(students.name));
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
