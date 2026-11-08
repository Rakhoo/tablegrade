/**
 * Schema version of the first release. Databases and backups of this version need no
 * migration; older ones stem from development and are not supported.
 */
export const BASELINE_VERSION = 20;

/** Creates the schema of the first release in an empty database. */
export const BASELINE: string[] = [
  `CREATE TABLE Holidays (
    id INTEGER PRIMARY KEY,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    summer INTEGER,
    publicHoliday INTEGER
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
    double INTEGER NOT NULL,
    day2 INTEGER,
    hour2 INTEGER,
    double2 INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE Students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT,
    image TEXT,
    firstName TEXT NOT NULL DEFAULT '',
    lastName TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE Classes2Students (
    classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
    studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
    x INTEGER,
    y INTEGER,
    hidden INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (classId, studentId)
  )`,
  `CREATE TABLE Grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment TEXT,
    date TEXT NOT NULL,
    classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
    studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
    warnings INTEGER NOT NULL DEFAULT 0,
    grade REAL,
    mark REAL,
    absent INTEGER NOT NULL DEFAULT 0,
    projectMark REAL
  )`,
  "CREATE UNIQUE INDEX GradesUnique ON Grades (classId, studentId, date)",
  "CREATE TABLE CancelledDays (date TEXT PRIMARY KEY)",
  `CREATE TABLE CancelledLessons (
    classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    PRIMARY KEY (classId, date)
  )`,
  `CREATE TABLE LessonTypes (
    classId INTEGER NOT NULL REFERENCES Classes(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    PRIMARY KEY (classId, date, type)
  )`,
  `CREATE TABLE Traits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#9ca3af'
  )`,
  `CREATE TABLE Students2Traits (
    studentId INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
    traitId INTEGER NOT NULL REFERENCES Traits(id) ON DELETE CASCADE,
    PRIMARY KEY (studentId, traitId)
  )`,
  "CREATE TABLE Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  `CREATE TABLE SchoolYears (
    year INTEGER PRIMARY KEY,
    secondHalfStart TEXT NOT NULL
  )`,
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
];

/**
 * Migrations after the first release, applied in order: entry `i` brings the database to
 * version `BASELINE_VERSION + i + 1`. Never change an existing entry, always append a new one.
 */
export const MIGRATIONS: string[][] = [];
