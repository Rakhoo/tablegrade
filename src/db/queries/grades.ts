import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { grades, type GradeEntry } from "../schema";

/** Returns the grades, comments and warnings of a class for one lesson date. */
export const getGrades = (classId: number, date: string) =>
  db
    .select()
    .from(grades)
    .where(and(eq(grades.classId, classId), eq(grades.date, date)));

/** Inserts or updates the grade entry of a student and drops entries that became empty. */
async function upsertGrade(
  key: { classId: number; studentId: number; date: string },
  values: Partial<Pick<GradeEntry, "grade" | "comment" | "warnings">>,
) {
  await db
    .insert(grades)
    .values({ ...key, ...values })
    .onConflictDoUpdate({
      target: [grades.classId, grades.studentId, grades.date],
      set: values,
    });
  await db
    .delete(grades)
    .where(
      and(
        eq(grades.classId, key.classId),
        eq(grades.studentId, key.studentId),
        eq(grades.date, key.date),
        isNull(grades.grade),
        isNull(grades.comment),
        eq(grades.warnings, 0),
      ),
    );
}

/** Sets (or with `null` removes) the symbol grade of a student for a lesson date. */
export const setGrade = (
  classId: number,
  studentId: number,
  date: string,
  grade: string | null,
) => upsertGrade({ classId, studentId, date }, { grade });

/** Sets (or with an empty text removes) the comment of a student for a lesson date. */
export const setComment = (
  classId: number,
  studentId: number,
  date: string,
  comment: string,
) =>
  upsertGrade(
    { classId, studentId, date },
    { comment: comment.trim() || null },
  );

/** Sets the number of warnings (0–2) of a student for a lesson date. */
export const setWarnings = (
  classId: number,
  studentId: number,
  date: string,
  warnings: number,
) => upsertGrade({ classId, studentId, date }, { warnings });

/** Parts of a lesson's entries that can be reset independently. */
export type LessonParts = {
  warnings: boolean;
  grades: boolean;
  comments: boolean;
};

/** Resets the selected parts of all entries of a class for one lesson date. */
export async function clearLesson(
  classId: number,
  date: string,
  parts: LessonParts,
) {
  if (!parts.warnings && !parts.grades && !parts.comments) return;
  const lesson = and(eq(grades.classId, classId), eq(grades.date, date));
  await db
    .update(grades)
    .set({
      ...(parts.grades && { grade: null }),
      ...(parts.comments && { comment: null }),
      ...(parts.warnings && { warnings: 0 }),
    })
    .where(lesson);
  await db
    .delete(grades)
    .where(
      and(
        lesson,
        isNull(grades.grade),
        isNull(grades.comment),
        eq(grades.warnings, 0),
      ),
    );
}
