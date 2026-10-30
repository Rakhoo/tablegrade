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
];
