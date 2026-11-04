import { and, eq, inArray, isNull } from "drizzle-orm";
import { isExamDay, MARK_KIND, type LessonType } from "../../lib/grades";
import { getLessonChains, getLessonCompletion } from "../../lib/lessonChains";
import { lessonDateOf, lessonKey } from "../../lib/lessons";
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

/** Returns all entries of all classes, to check them against a new calendar. */
export const getAllGrades = () => db.select().from(grades);

/** Deletes the given entries. */
export const deleteEntries = (ids: number[]) =>
  db.delete(grades).where(inArray(grades.id, ids));

/** Returns the special lessons as a map from lesson key to their types. */
export async function getLessonTypes() {
  const rows = await db.select().from(lessonTypes);
  const types: Record<string, LessonType[]> = {};
  for (const row of rows) {
    const key = lessonKey(row.classId, row.date);
    types[key] = [...(types[key] ?? []), row.type];
  }
  return types;
}

/**
 * Returns the keys (see `lessonKey`) of all complete lessons, judged by their oral grades (or
 * the marks of an exam) as in `getLessonCompletion`; hidden students do not count.
 */
export async function getCompletedLessons(classId?: number) {
  const [entries, members, types] = await Promise.all([
    db
      .select({
        classId: grades.classId,
        studentId: grades.studentId,
        date: grades.date,
        grade: grades.grade,
        mark: grades.mark,
        projectMark: grades.projectMark,
        absent: grades.absent,
      })
      .from(grades)
      .where(classId ? eq(grades.classId, classId) : undefined),
    db
      .select({
        classId: classStudents.classId,
        studentId: classStudents.studentId,
      })
      .from(classStudents)
      .where(
        and(
          eq(classStudents.hidden, false),
          classId ? eq(classStudents.classId, classId) : undefined,
        ),
      ),
    getLessonTypes(),
  ]);
  const complete: string[] = [];
  for (const id of new Set(members.map((member) => member.classId))) {
    const studentIds = members
      .filter((member) => member.classId == id)
      .map((member) => member.studentId);
    const classEntries = entries.filter(
      (entry) => entry.classId == id && studentIds.includes(entry.studentId),
    );
    const typesOf = (date: string) => types[lessonKey(id, date)] ?? [];
    const typedDates = Object.keys(types)
      .filter((key) => key.startsWith(`${id}|`))
      .map(lessonDateOf);
    const chains = getLessonChains(typedDates, typesOf);
    const dates = new Set([
      ...classEntries.map((entry) => entry.date),
      ...typedDates,
    ]);
    for (const date of dates) {
      const { lesson } = getLessonCompletion(
        date,
        typesOf(date),
        studentIds,
        classEntries,
        chains,
      );
      if (lesson) complete.push(lessonKey(id, date));
    }
  }
  return complete;
}

/** Drops entries of a lesson that became empty. */
const emptyEntries = (classId: number, date: string) =>
  and(
    eq(grades.classId, classId),
    eq(grades.date, date),
    isNull(grades.grade),
    isNull(grades.mark),
    isNull(grades.projectMark),
    isNull(grades.comment),
    eq(grades.absent, false),
    eq(grades.warnings, 0),
  );

/**
 * Sets the types of a lesson (see `toggleLessonType`) and removes what they do not use: an exam
 * has no oral grades, a lesson without exam or retake no exam marks, one without project or
 * extension no project marks.
 */
export async function setLessonTypes(
  classId: number,
  date: string,
  types: LessonType[],
) {
  const lesson = and(eq(grades.classId, classId), eq(grades.date, date));
  const typeRows = and(
    eq(lessonTypes.classId, classId),
    eq(lessonTypes.date, date),
  );
  const kinds = new Set(types.map((type) => MARK_KIND[type]));
  await client.transaction(async (tx) => {
    if (isExamDay(types)) {
      await tx.query(db.update(grades).set({ grade: null }).where(lesson));
    }
    if (!kinds.has("exam")) {
      await tx.query(db.update(grades).set({ mark: null }).where(lesson));
    }
    if (!kinds.has("project")) {
      await tx.query(
        db.update(grades).set({ projectMark: null }).where(lesson),
      );
    }
    await tx.query(db.delete(grades).where(emptyEntries(classId, date)));
    await tx.query(db.delete(lessonTypes).where(typeRows));
    for (const type of types) {
      await tx.query(db.insert(lessonTypes).values({ classId, date, type }));
    }
  });
}

/** Inserts or updates the grade entry of a student and drops entries that became empty. */
async function upsertGrade(
  key: { classId: number; studentId: number; date: string },
  values: Partial<
    Pick<
      GradeEntry,
      "grade" | "mark" | "projectMark" | "absent" | "comment" | "warnings"
    >
  >,
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

/** Changes the symbol, marks or comment of a student for a lesson date; `null` removes them. */
export const setAssessment = (
  classId: number,
  studentId: number,
  date: string,
  values: Partial<
    Pick<GradeEntry, "grade" | "mark" | "projectMark" | "absent" | "comment">
  >,
) => upsertGrade({ classId, studentId, date }, values);

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
      ...(parts.grades && {
        grade: null,
        mark: null,
        projectMark: null,
        absent: false,
      }),
      ...(parts.comments && { comment: null }),
      ...(parts.warnings && { warnings: 0 }),
    })
    .where(lesson);
  await db.delete(grades).where(emptyEntries(classId, date));
}
