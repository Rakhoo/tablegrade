import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { DEVICE_SETTING_KEYS } from "../lib/settings";
import { openTestDb } from "../test/sqliteDb";

const CLASS = "c1";
const ANNA = "s1";
const BEN = "s2";

/** Sets a `_sync_state` value. */
const setState = (db: DatabaseSync, key: string, value: string) =>
  db
    .prepare("INSERT OR REPLACE INTO _sync_state (key, value) VALUES (?, ?)")
    .run(key, value);

/** The recorded changes as `table pk` lines, oldest first, and clears the outbox. */
function drain(db: DatabaseSync) {
  const rows = db.prepare("SELECT tbl, pk FROM _outbox ORDER BY seq").all() as {
    tbl: string;
    pk: string;
  }[];
  db.exec("DELETE FROM _outbox");
  return rows.map(({ tbl, pk }) => `${tbl} ${pk}`);
}

/** A class with two students, a trait, a duty, a grade, a report and lesson marks. */
function seed(db: DatabaseSync) {
  db.exec(`
    INSERT INTO Classes (id, subject, number, year, part, day, hour, double)
      VALUES ('${CLASS}', 'Mathe', '7', 2025, '1', 1, 2, 0);
    INSERT INTO Students (id, firstName, lastName) VALUES ('${ANNA}', 'Anna', 'A'), ('${BEN}', 'Ben', 'B');
    INSERT INTO Traits (id, name) VALUES ('t1', 'Brille');
    INSERT INTO Duties (id, name, symbol, color) VALUES ('d1', 'Tafel', 'board', '#fff');
    INSERT INTO Classes2Students (classId, studentId, dutyId) VALUES ('${CLASS}', '${ANNA}', 'd1'), ('${CLASS}', '${BEN}', NULL);
    INSERT INTO Students2Traits (studentId, traitId) VALUES ('${ANNA}', 't1');
    INSERT INTO Grades (id, date, classId, studentId, grade) VALUES ('g1', '2025-09-01', '${CLASS}', '${ANNA}', 2);
    INSERT INTO CancelledLessons (classId, date) VALUES ('${CLASS}', '2025-09-08');
    INSERT INTO LessonTypes (classId, date, type) VALUES ('${CLASS}', '2025-09-15', 'exam');
    INSERT INTO Reports (classId, date, kind) VALUES ('${CLASS}', '2025-12-01', 'part');
    INSERT INTO ReportGrades (classId, date, kind, studentId, grade) VALUES ('${CLASS}', '2025-12-01', 'part', '${ANNA}', 2);
  `);
}

describe("outbox triggers", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = openTestDb();
    setState(db, "enabled", "1");
  });

  it("record inserts, updates and deletes with their primary key", () => {
    seed(db);
    db.exec("INSERT INTO CancelledDays (date) VALUES ('2025-10-03')");
    db.exec(
      "INSERT INTO SchoolYears (year, secondHalfStart) VALUES (2025, '2026-02-01')",
    );
    db.exec(`INSERT INTO Settings (key, value) VALUES ('theme', '"lavender"')`);
    expect(drain(db)).toEqual([
      `Classes ["${CLASS}"]`,
      `Students ["${ANNA}"]`,
      `Students ["${BEN}"]`,
      'Traits ["t1"]',
      'Duties ["d1"]',
      `Classes2Students ["${CLASS}","${ANNA}"]`,
      `Classes2Students ["${CLASS}","${BEN}"]`,
      `Students2Traits ["${ANNA}","t1"]`,
      'Grades ["g1"]',
      `CancelledLessons ["${CLASS}","2025-09-08"]`,
      `LessonTypes ["${CLASS}","2025-09-15","exam"]`,
      `Reports ["${CLASS}","2025-12-01","part"]`,
      `ReportGrades ["${CLASS}","2025-12-01","part","${ANNA}"]`,
      'CancelledDays ["2025-10-03"]',
      "SchoolYears [2025]",
      'Settings ["theme"]',
    ]);
    db.exec("UPDATE Grades SET grade = 3 WHERE id = 'g1'");
    db.exec("DELETE FROM CancelledDays");
    expect(drain(db)).toEqual([
      'Grades ["g1"]',
      'CancelledDays ["2025-10-03"]',
    ]);
  });

  it("record the old key too when an update changes it", () => {
    db.exec("INSERT INTO CancelledDays (date) VALUES ('2025-10-03')");
    drain(db);
    db.exec("UPDATE CancelledDays SET date = '2025-10-04'");
    expect(drain(db)).toEqual([
      'CancelledDays ["2025-10-04"]',
      'CancelledDays ["2025-10-03"]',
    ]);
  });

  it("record rows deleted or changed by foreign key actions", () => {
    seed(db);
    drain(db);
    db.exec("DELETE FROM Duties WHERE id = 'd1'");
    // Foreign key actions run before the AFTER trigger of the parent row
    expect(drain(db)).toEqual([
      `Classes2Students ["${CLASS}","${ANNA}"]`,
      'Duties ["d1"]',
    ]);
    db.exec(`DELETE FROM Classes WHERE id = '${CLASS}'`);
    expect([...drain(db)].sort()).toEqual(
      [
        `Classes ["${CLASS}"]`,
        `Classes2Students ["${CLASS}","${ANNA}"]`,
        `Classes2Students ["${CLASS}","${BEN}"]`,
        'Grades ["g1"]',
        `CancelledLessons ["${CLASS}","2025-09-08"]`,
        `LessonTypes ["${CLASS}","2025-09-15","exam"]`,
        `Reports ["${CLASS}","2025-12-01","part"]`,
        `ReportGrades ["${CLASS}","2025-12-01","part","${ANNA}"]`,
      ].sort(),
    );
    db.exec(`DELETE FROM Students WHERE id = '${ANNA}'`);
    expect([...drain(db)].sort()).toEqual(
      [`Students ["${ANNA}"]`, `Students2Traits ["${ANNA}","t1"]`].sort(),
    );
  });

  it("leave out device settings", () => {
    for (const key of DEVICE_SETTING_KEYS)
      db.prepare("INSERT INTO Settings (key, value) VALUES (?, 'null')").run(
        key,
      );
    db.exec(`UPDATE Settings SET value = '"x"'`);
    db.exec("DELETE FROM Settings");
    expect(drain(db)).toEqual([]);
  });

  it("stay silent while sync is off or the sync engine applies changes", () => {
    setState(db, "enabled", "0");
    seed(db);
    expect(drain(db)).toEqual([]);
    setState(db, "enabled", "1");
    setState(db, "applying", "1");
    db.exec(`DELETE FROM Classes WHERE id = '${CLASS}'`);
    expect(drain(db)).toEqual([]);
    setState(db, "applying", "0");
    db.exec(`DELETE FROM Students WHERE id = '${BEN}'`);
    expect(drain(db)).toEqual([`Students ["${BEN}"]`]);
  });

  it("stay silent without any sync state", () => {
    db.exec("DELETE FROM _sync_state");
    seed(db);
    expect(drain(db)).toEqual([]);
  });
});
