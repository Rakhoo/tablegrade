import type { MockData } from "../../lib/mockData";
import { fillNicknames } from "../../lib/studentRoster";
import { db } from "../client";
import {
  cancelledDays,
  cancelledLessons,
  classStudents,
  duties,
  grades,
  lessonTypes,
  reportGrades,
  reports,
  schoolClasses,
  students,
  studentTraits,
  traits,
} from "../schema";
import { saveSchoolClass } from "./schoolClasses";
import { getClassStudents } from "./students";

/** Rows per insert, well below SQLite's limit of bound values. */
const CHUNK = 400;

/** Inserts rows in chunks. */
async function insertAll<Row>(
  rows: Row[],
  insert: (chunk: Row[]) => Promise<unknown>,
) {
  for (let start = 0; start < rows.length; start += CHUNK) {
    await insert(rows.slice(start, start + CHUNK));
  }
}

/**
 * Deletes all classes, students, entries, reports, lesson states, traits and duties. Settings,
 * holidays and school years stay.
 */
export async function deleteSchoolData() {
  // Children first, so no foreign key blocks a deletion
  for (const table of [
    reportGrades,
    reports,
    grades,
    lessonTypes,
    cancelledLessons,
    cancelledDays,
    studentTraits,
    classStudents,
    students,
    schoolClasses,
    traits,
    duties,
  ]) {
    await db.delete(table);
  }
}

/** Replaces all school data with mock data (see `createMockData`). */
export async function replaceWithMockData(data: MockData) {
  await deleteSchoolData();
  const traitRows = await db
    .insert(traits)
    .values(data.traits)
    .returning({ id: traits.id, name: traits.name });
  const dutyRows = await db
    .insert(duties)
    .values(data.duties)
    .returning({ id: duties.id, name: duties.name });
  const idOf = (rows: { id: string; name: string }[], name: string) =>
    rows.find((row) => row.name == name)?.id;

  for (const mock of data.classes) {
    // Shared first names get nicknames like "Lea N.", as on importing a list
    const classId = await saveSchoolClass(
      mock.cls,
      fillNicknames(
        mock.students.map((student) => ({
          firstName: student.firstName,
          lastName: student.lastName,
          nickname: null,
          image: student.image,
          traitIds: student.traitNames.flatMap(
            (name) => idOf(traitRows, name) ?? [],
          ),
          hidden: false,
          dutyId: student.dutyName
            ? (idOf(dutyRows, student.dutyName) ?? null)
            : null,
        })),
      ),
    );
    // Names are unique within a mock class, so they find the saved students
    const saved = await getClassStudents(classId);
    const studentIds = mock.students.map(
      ({ firstName, lastName }) =>
        saved.find(
          (student) =>
            student.firstName == firstName && student.lastName == lastName,
        )!.id,
    );
    await insertAll(
      mock.lessonTypes.map((type) => ({ classId, ...type })),
      (chunk) => db.insert(lessonTypes).values(chunk),
    );
    await insertAll(
      mock.reports.map((report) => ({ classId, ...report })),
      (chunk) => db.insert(reports).values(chunk),
    );
    await insertAll(
      mock.entries.map(({ student, ...entry }) => ({
        ...entry,
        classId,
        studentId: studentIds[student],
      })),
      (chunk) => db.insert(grades).values(chunk),
    );
  }
}
