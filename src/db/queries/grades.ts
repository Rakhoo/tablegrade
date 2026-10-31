import { and, count, eq, isNull, ne } from "drizzle-orm";
import { ABSENT_GRADE, type LessonType } from "../../lib/grades";
import { lessonKey } from "../../lib/lessons";
import { client, db } from "../client";
import { classStudents, grades, lessonTypes, type GradeEntry } from "../schema";

/** Returns the grades, comments and warnings of a class for one lesson date. */
export const getGrades = (classId: number, date: string) =>
  db
    .select()
    .from(grades)
    .where(and(eq(grades.classId, classId), eq(grades.date, date)));

/** Returns all grades, comments and warnings of a class, for the overview table. */
export const getClassGrades = (classId: number) =>
  db.select().from(grades).where(eq(grades.classId, classId));

/** Returns the special lessons as a map from lesson key to type. */
export async function getLessonTypes() {
  const rows = await db.select().from(lessonTypes);
  return Object.fromEntries(
    rows.map((row) => [lessonKey(row.classId, row.date), row.type]),
  ) as Record<string, LessonType>;
}

/**
 * Returns the keys (see `lessonKey`) of all complete lessons: every student of the class has
 * a symbol, which includes "excused". Exams count marks instead of symbols.
 */
export async function getCompletedLessons(classId?: number) {
  const totals = await db
    .select({
      classId: grades.classId,
      date: grades.date,
      symbols: count(grades.grade),
      marks: count(grades.mark),
    })
    .from(grades)
    .where(classId ? eq(grades.classId, classId) : undefined)
    .groupBy(grades.classId, grades.date);
  const sizes = await db
    .select({ classId: classStudents.classId, total: count() })
    .from(classStudents)
    .groupBy(classStudents.classId);
  const types = await getLessonTypes();
  const sizeOf = new Map(sizes.map((row) => [row.classId, row.total]));
  return totals
    .map((row) => ({ ...row, key: lessonKey(row.classId, row.date) }))
    .filter(
      (row) =>
        (types[row.key] == "exam" ? row.symbols + row.marks : row.symbols) >=
        (sizeOf.get(row.classId) ?? Infinity),
    )
    .map((row) => row.key);
}

/** Drops entries of a lesson that became empty. */
const emptyEntries = (classId: number, date: string) =>
  and(
    eq(grades.classId, classId),
    eq(grades.date, date),
    isNull(grades.grade),
    isNull(grades.mark),
    isNull(grades.comment),
    eq(grades.warnings, 0),
  );

/**
 * Changes the type of a lesson and removes what the new type does not use: an exam has no
 * symbols except "excused", a regular lesson has no marks.
 */
export async function setLessonType(
  classId: number,
  date: string,
  type: LessonType,
) {
  const lesson = and(eq(grades.classId, classId), eq(grades.date, date));
  const typeRow = and(
    eq(lessonTypes.classId, classId),
    eq(lessonTypes.date, date),
  );
  await client.transaction(async (tx) => {
    if (type == "exam") {
      await tx.query(
        db
          .update(grades)
          .set({ grade: null })
          .where(and(lesson, ne(grades.grade, ABSENT_GRADE))),
      );
    } else if (type == "normal") {
      await tx.query(db.update(grades).set({ mark: null }).where(lesson));
    }
    await tx.query(db.delete(grades).where(emptyEntries(classId, date)));
    await tx.query(db.delete(lessonTypes).where(typeRow));
    if (type != "normal") {
      await tx.query(db.insert(lessonTypes).values({ classId, date, type }));
    }
  });
}

/** Inserts or updates the grade entry of a student and drops entries that became empty. */
async function upsertGrade(
  key: { classId: number; studentId: number; date: string },
  values: Partial<Pick<GradeEntry, "grade" | "mark" | "comment" | "warnings">>,
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
        emptyEntries(key.classId, key.date),
        eq(grades.studentId, key.studentId),
      ),
    );
}

/** Sets the symbol and/or mark of a student for a lesson date; `null` removes them. */
export const setAssessment = (
  classId: number,
  studentId: number,
  date: string,
  values: { grade?: string | null; mark?: string | null },
) => upsertGrade({ classId, studentId, date }, values);

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
      ...(parts.grades && { grade: null, mark: null }),
      ...(parts.comments && { comment: null }),
      ...(parts.warnings && { warnings: 0 }),
    })
    .where(lesson);
  await db.delete(grades).where(emptyEntries(classId, date));
}
