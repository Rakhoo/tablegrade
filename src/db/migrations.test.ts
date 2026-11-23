import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrateTo, openTestDb } from "../test/sqliteDb";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Fills a version 21 database with two classes, students and all dependent rows. */
function seedVersion21(db: DatabaseSync) {
  db.exec(`
    INSERT INTO Classes (id, subject, number, letter, year, part, day, hour, double)
      VALUES (1, 'Mathe', '7', 'a', 2025, '1', 1, 2, 0), (2, 'Physik', 'Q1', NULL, 2025, '1', 3, 4, 1);
    INSERT INTO Students (id, nickname, firstName, lastName)
      VALUES (10, 'Anni', 'Anna', 'Arm'), (11, NULL, 'Ben', 'Bach'), (12, NULL, 'Cem', 'Cetin');
    INSERT INTO Traits (id, name) VALUES (5, 'Brille');
    INSERT INTO Duties (id, name, symbol, color) VALUES (7, 'Tafel', 'T', '#fff');
    INSERT INTO Classes2Students (classId, studentId, x, y, dutyId)
      VALUES (1, 10, 0, 0, 7), (1, 11, 1, 0, NULL), (2, 11, 0, 1, 7), (2, 12, 1, 1, NULL);
    INSERT INTO Grades (id, date, classId, studentId, grade)
      VALUES (100, '2025-09-01', 1, 10, 2), (101, '2025-09-01', 1, 11, 3), (102, '2025-09-03', 2, 12, 1);
    INSERT INTO Students2Traits (studentId, traitId) VALUES (10, 5), (12, 5);
    INSERT INTO CancelledLessons (classId, date) VALUES (1, '2025-09-08');
    INSERT INTO LessonTypes (classId, date, type) VALUES (1, '2025-09-15', 'exam');
    INSERT INTO Reports (classId, date, kind) VALUES (1, '2025-12-01', 'part'), (2, '2025-12-01', 'part');
    INSERT INTO ReportGrades (classId, date, kind, studentId, grade)
      VALUES (1, '2025-12-01', 'part', 10, 2), (2, '2025-12-01', 'part', 12, 1);
    INSERT INTO Settings (key, value) VALUES ('theme', '"lavender"');
  `);
}

/** All rows of a query as plain objects. */
const all = (db: DatabaseSync, sql: string) =>
  db.prepare(sql).all() as Record<string, unknown>[];

/** The id of a class, student, trait or duty found by a unique column value. */
const idOf = (db: DatabaseSync, table: string, column: string, value: string) =>
  (
    db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).get(value) as {
      id: string;
    }
  ).id;

describe("migration 22 (UUIDs)", () => {
  function migrated() {
    const db = openTestDb(21);
    seedVersion21(db);
    migrateTo(db, 22);
    return db;
  }

  it("gives every row a new UUID and keeps all rows", () => {
    const db = migrated();
    for (const table of ["Classes", "Students", "Grades", "Traits", "Duties"])
      for (const { id } of all(db, `SELECT id FROM ${table}`))
        expect(id).toMatch(UUID);
    const counts = Object.fromEntries(
      [
        "Classes",
        "Students",
        "Grades",
        "Traits",
        "Duties",
        "Classes2Students",
        "Students2Traits",
        "CancelledLessons",
        "LessonTypes",
        "Reports",
        "ReportGrades",
        "Settings",
      ].map((table) => [
        table,
        all(db, `SELECT count(*) AS n FROM ${table}`)[0].n,
      ]),
    );
    expect(counts).toEqual({
      Classes: 2,
      Students: 3,
      Grades: 3,
      Traits: 1,
      Duties: 1,
      Classes2Students: 4,
      Students2Traits: 2,
      CancelledLessons: 1,
      LessonTypes: 1,
      Reports: 2,
      ReportGrades: 2,
      Settings: 1,
    });
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
    expect(
      all(
        db,
        "SELECT name FROM sqlite_master WHERE name LIKE '%\\_new' ESCAPE '\\' OR name LIKE '\\_ids%' ESCAPE '\\'",
      ),
    ).toEqual([]);
  });

  it("keeps all relations", () => {
    const db = migrated();
    const math = idOf(db, "Classes", "subject", "Mathe");
    const anna = idOf(db, "Students", "firstName", "Anna");
    const cem = idOf(db, "Students", "firstName", "Cem");
    const duty = idOf(db, "Duties", "name", "Tafel");
    const trait = idOf(db, "Traits", "name", "Brille");
    expect(
      all(db, "SELECT dutyId FROM Classes2Students WHERE dutyId IS NOT NULL"),
    ).toHaveLength(2);
    expect(
      all(
        db,
        `SELECT dutyId FROM Classes2Students WHERE classId = '${math}' AND studentId = '${anna}'`,
      ),
    ).toEqual([{ dutyId: duty }]);
    expect(
      all(
        db,
        `SELECT grade FROM Grades WHERE classId = '${math}' AND studentId = '${anna}'`,
      ),
    ).toEqual([{ grade: 2 }]);
    expect(
      all(
        db,
        `SELECT studentId FROM Students2Traits WHERE traitId = '${trait}' ORDER BY studentId`,
      ),
    ).toEqual(
      [{ studentId: anna }, { studentId: cem }].sort((a, b) =>
        a.studentId.localeCompare(b.studentId),
      ),
    );
    expect(
      all(
        db,
        `SELECT studentId, grade FROM ReportGrades WHERE classId = '${math}'`,
      ),
    ).toEqual([{ studentId: anna, grade: 2 }]);
    expect(all(db, "SELECT classId FROM CancelledLessons")).toEqual([
      { classId: math },
    ]);
    expect(all(db, "SELECT classId FROM LessonTypes")).toEqual([
      { classId: math },
    ]);
  });

  it("keeps the cascades and the unique grade index", () => {
    const db = migrated();
    const math = idOf(db, "Classes", "subject", "Mathe");
    const anna = idOf(db, "Students", "firstName", "Anna");
    expect(() =>
      db.exec(
        `INSERT INTO Grades (id, date, classId, studentId) VALUES ('x', '2025-09-01', '${math}', '${anna}')`,
      ),
    ).toThrow(/UNIQUE/);
    db.exec("DELETE FROM Duties");
    expect(
      all(
        db,
        "SELECT count(*) AS n FROM Classes2Students WHERE dutyId IS NOT NULL",
      ),
    ).toEqual([{ n: 0 }]);
    db.exec("DELETE FROM Traits");
    expect(all(db, "SELECT count(*) AS n FROM Students2Traits")).toEqual([
      { n: 0 },
    ]);
    db.exec(`DELETE FROM Classes WHERE id = '${math}'`);
    for (const table of [
      "Classes2Students",
      "Grades",
      "CancelledLessons",
      "LessonTypes",
      "Reports",
      "ReportGrades",
    ])
      expect(
        all(db, `SELECT count(*) AS n FROM ${table} WHERE classId = '${math}'`),
      ).toEqual([{ n: 0 }]);
    expect(all(db, "SELECT count(*) AS n FROM ReportGrades")).toEqual([
      { n: 1 },
    ]);
    db.exec(`DELETE FROM Students WHERE id = '${anna}'`);
    expect(
      all(db, `SELECT count(*) AS n FROM Grades WHERE studentId = '${anna}'`),
    ).toEqual([{ n: 0 }]);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("migrates an empty database", () => {
    const db = openTestDb();
    // Renaming must also have renamed the references between the rebuilt tables
    expect(
      all(
        db,
        "SELECT name FROM sqlite_master WHERE sql LIKE '%\\_new%' ESCAPE '\\'",
      ),
    ).toEqual([]);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
    expect(
      all(
        db,
        "SELECT type FROM pragma_table_info('Classes') WHERE name = 'id'",
      ),
    ).toEqual([{ type: "TEXT" }]);
  });
});
