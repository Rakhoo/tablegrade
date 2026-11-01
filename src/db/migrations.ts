/**
 * Schema migrations, applied in order. The index + 1 is stored as `PRAGMA user_version`.
 * Never change an existing entry, always append a new one.
 */
export const MIGRATIONS: string[][] = [
  [
    // Tables of the pre-release schema did not contain real data
    "DROP TABLE IF EXISTS Grades",
    "DROP TABLE IF EXISTS Classes2Students",
    "DROP TABLE IF EXISTS Students",
    "DROP TABLE IF EXISTS Classes",
    "DROP TABLE IF EXISTS Holidays",
    `CREATE TABLE Holidays (
      id INTEGER PRIMARY KEY,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      summer INTEGER
    )`,
    `CREATE TABLE Classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      number TEXT NOT NULL,
      letter TEXT,
      year INTEGER NOT NULL,
      part TEXT NOT NULL,
      day INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      double INTEGER NOT NULL
    )`,
    `CREATE TABLE Students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      image TEXT
    )`,
    `CREATE TABLE Classes2Students (
      classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
      studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
      x INTEGER,
      y INTEGER,
      PRIMARY KEY (classId, studentId)
    )`,
    `CREATE TABLE Grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade TEXT,
      comment TEXT,
      date TEXT NOT NULL,
      classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
      studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE
    )`,
    "CREATE UNIQUE INDEX GradesUnique ON Grades (classId, studentId, date)",
  ],
  // Seat grid switched from whole seats to half-seat cells
  ["UPDATE Classes2Students SET x = x * 2, y = y * 2 WHERE x IS NOT NULL"],
  // Distinguish public holidays from vacations; the cache is refetched to fill the new column
  [
    "ALTER TABLE Holidays ADD COLUMN publicHoliday INTEGER",
    "DELETE FROM Holidays",
  ],
  // Warnings ("Ermahnungen") per student and lesson
  ["ALTER TABLE Grades ADD COLUMN warnings INTEGER NOT NULL DEFAULT 0"],
  // Days without lessons marked by the teacher (illness, bridge days, …)
  ["CREATE TABLE CancelledDays (date TEXT PRIMARY KEY)"],
  // Separate first and last name (split at the first space) and selectable student traits
  [
    "ALTER TABLE Students ADD COLUMN firstName TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE Students ADD COLUMN lastName TEXT NOT NULL DEFAULT ''",
    `UPDATE Students SET
      firstName = CASE WHEN instr(trim(name), ' ') > 0
        THEN substr(trim(name), 1, instr(trim(name), ' ') - 1) ELSE trim(name) END,
      lastName = CASE WHEN instr(trim(name), ' ') > 0
        THEN trim(substr(trim(name), instr(trim(name), ' ') + 1)) ELSE '' END`,
    "ALTER TABLE Students DROP COLUMN name",
    `CREATE TABLE Traits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )`,
    `INSERT INTO Traits (name) VALUES
      ('ADS'), ('ADHS'), ('ESE'), ('Lernen'), ('Autismus'), ('Diabetes'), ('LRS')`,
    `CREATE TABLE Students2Traits (
      studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
      traitId INTEGER NOT NULL REFERENCES Traits(id) ON DELETE CASCADE,
      PRIMARY KEY (studentId, traitId)
    )`,
  ],
  // Class letters are lowercase ("5a")
  ["UPDATE Classes SET letter = lower(letter) WHERE letter IS NOT NULL"],
  // Optional second weekly lesson
  [
    "ALTER TABLE Classes ADD COLUMN day2 INTEGER",
    "ALTER TABLE Classes ADD COLUMN hour2 INTEGER",
    "ALTER TABLE Classes ADD COLUMN double2 INTEGER NOT NULL DEFAULT 0",
  ],
  // The mixed class letter is lowercase like all letters
  ["UPDATE Classes SET letter = 'mix' WHERE letter = 'Mix'"],
  // Single cancelled lessons
  [
    `CREATE TABLE CancelledLessons (
      classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (classId, date)
    )`,
  ],
  // Exams and projects with classic marks
  [
    "ALTER TABLE Grades ADD COLUMN mark TEXT",
    `CREATE TABLE LessonTypes (
      classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (classId, date)
    )`,
  ],
  // The mark "1+" does not exist in German schools
  ["UPDATE Grades SET mark = '1' WHERE mark = '1+'"],
  // Students can be hidden from a class without losing their grades
  ["ALTER TABLE Classes2Students ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0"],
  // New trait "DaZ" (Deutsch als Zweitsprache)
  ["INSERT INTO Traits (name) VALUES ('DAZ')"],
  // Settings, and school years with the second half's start for all years in use
  [
    "CREATE TABLE Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    `CREATE TABLE SchoolYears (
      year INTEGER PRIMARY KEY,
      secondHalfStart TEXT NOT NULL
    )`,
    `INSERT INTO SchoolYears (year, secondHalfStart)
      SELECT DISTINCT year, (year + 1) || '-02-01' FROM Classes`,
  ],
  // Grades as numbers on one scale with an own flag for "excused"; the old minus becomes 4-
  [
    "ALTER TABLE Grades RENAME COLUMN grade TO symbolKey",
    "ALTER TABLE Grades RENAME COLUMN mark TO markKey",
    "ALTER TABLE Grades ADD COLUMN grade REAL",
    "ALTER TABLE Grades ADD COLUMN mark REAL",
    "ALTER TABLE Grades ADD COLUMN absent INTEGER NOT NULL DEFAULT 0",
    `UPDATE Grades SET
      absent = symbolKey IS 'E',
      grade = CASE symbolKey
        WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3+' THEN 2.7 WHEN '3' THEN 3
        WHEN '3-' THEN 3.3 WHEN '4' THEN 4.3 WHEN '5' THEN 6 END,
      mark = CASE WHEN markKey IS NOT NULL THEN round(
        substr(markKey, 1, 1) + CASE substr(markKey, 2)
          WHEN '+' THEN -0.3 WHEN '-' THEN 0.3 ELSE 0 END, 1) END`,
    "ALTER TABLE Grades DROP COLUMN symbolKey",
    "ALTER TABLE Grades DROP COLUMN markKey",
  ],
  // Traits are edited freely now; new installations start without any
  [
    "ALTER TABLE Traits ADD COLUMN color TEXT NOT NULL DEFAULT '#9ca3af'",
    `UPDATE Traits SET color = CASE name
      WHEN 'ADHS' THEN '#4f46e5' WHEN 'ADS' THEN '#38bdf8'
      WHEN 'Autismus' THEN '#14b8a6' WHEN 'DAZ' THEN '#475569'
      WHEN 'Diabetes' THEN '#ec4899' WHEN 'ESE' THEN '#a855f7'
      WHEN 'Lernen' THEN '#84cc16' WHEN 'LRS' THEN '#b45309' ELSE color END`,
    "DELETE FROM Traits WHERE NOT EXISTS (SELECT 1 FROM Classes)",
  ],
  // Quarter and half year grades, calculated unless set by hand
  [
    `CREATE TABLE Reports (
      classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      PRIMARY KEY (classId, date, kind)
    )`,
    `CREATE TABLE ReportGrades (
      classId INTEGER NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
      grade REAL NOT NULL,
      PRIMARY KEY (classId, date, kind, studentId),
      FOREIGN KEY (classId, date, kind)
        REFERENCES Reports(classId, date, kind) ON DELETE CASCADE
    )`,
  ],
  // Reports below the half are not tied to quarters. Copied, as the key of a report is referenced
  [
    `INSERT INTO Reports (classId, date, kind)
      SELECT classId, date, 'partial' FROM Reports WHERE kind = 'quarter'`,
    "UPDATE ReportGrades SET kind = 'partial' WHERE kind = 'quarter'",
    "DELETE FROM Reports WHERE kind = 'quarter'",
  ],
];
