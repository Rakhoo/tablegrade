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
 * SQL expression for a random UUID v4 in lower case, evaluated per row. Used by migration 22;
 * never change it, as migrations are fixed once released.
 */
const UUID_V4 = `lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)`;

/**
 * Migrations after the first release, applied in order: entry `i` brings the database to
 * version `BASELINE_VERSION + i + 1`. Never change an existing entry, always append a new one.
 */
export const MIGRATIONS: string[][] = [
  // 21: class duties, one per student and class
  [
    `CREATE TABLE Duties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      color TEXT NOT NULL
    )`,
    `ALTER TABLE Classes2Students
      ADD COLUMN dutyId INTEGER REFERENCES Duties(id) ON DELETE SET NULL`,
  ],
  // 22: text UUIDs instead of integer ids, so devices can create rows without conflicts.
  // Migrations run in a transaction with foreign keys on, so the tables are rebuilt as
  // `*_new`, the old ones dropped children first (no cascades hit new rows), then renamed,
  // which also renames the references between the new tables.
  [
    ...["Classes", "Students", "Grades", "Traits", "Duties"].flatMap(
      (table) => [
        `CREATE TABLE _ids_${table} (old INTEGER PRIMARY KEY, new TEXT NOT NULL UNIQUE)`,
        `INSERT INTO _ids_${table} (old, new) SELECT id, ${UUID_V4} FROM ${table}`,
      ],
    ),
    `CREATE TABLE Classes_new (
      id TEXT PRIMARY KEY NOT NULL,
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
    `INSERT INTO Classes_new
      SELECT m.new, subject, number, letter, year, part, day, hour, double, day2, hour2, double2
      FROM Classes JOIN _ids_Classes m ON m.old = Classes.id`,
    `CREATE TABLE Students_new (
      id TEXT PRIMARY KEY NOT NULL,
      nickname TEXT,
      image TEXT,
      firstName TEXT NOT NULL DEFAULT '',
      lastName TEXT NOT NULL DEFAULT ''
    )`,
    `INSERT INTO Students_new
      SELECT m.new, nickname, image, firstName, lastName
      FROM Students JOIN _ids_Students m ON m.old = Students.id`,
    `CREATE TABLE Traits_new (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#9ca3af'
    )`,
    `INSERT INTO Traits_new
      SELECT m.new, name, color FROM Traits JOIN _ids_Traits m ON m.old = Traits.id`,
    `CREATE TABLE Duties_new (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      color TEXT NOT NULL
    )`,
    `INSERT INTO Duties_new
      SELECT m.new, name, symbol, color FROM Duties JOIN _ids_Duties m ON m.old = Duties.id`,
    `CREATE TABLE Classes2Students_new (
      classId TEXT NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
      studentId TEXT NOT NULL REFERENCES Students_new(id) ON DELETE CASCADE,
      x INTEGER,
      y INTEGER,
      hidden INTEGER NOT NULL DEFAULT 0,
      dutyId TEXT REFERENCES Duties_new(id) ON DELETE SET NULL,
      PRIMARY KEY (classId, studentId)
    )`,
    `INSERT INTO Classes2Students_new
      SELECT c.new, s.new, x, y, hidden, d.new
      FROM Classes2Students t
      JOIN _ids_Classes c ON c.old = t.classId
      JOIN _ids_Students s ON s.old = t.studentId
      LEFT JOIN _ids_Duties d ON d.old = t.dutyId`,
    `CREATE TABLE Grades_new (
      id TEXT PRIMARY KEY NOT NULL,
      comment TEXT,
      date TEXT NOT NULL,
      classId TEXT NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
      studentId TEXT NOT NULL REFERENCES Students_new(id) ON DELETE CASCADE,
      warnings INTEGER NOT NULL DEFAULT 0,
      grade REAL,
      mark REAL,
      absent INTEGER NOT NULL DEFAULT 0,
      projectMark REAL
    )`,
    `INSERT INTO Grades_new
      SELECT g.new, comment, date, c.new, s.new, warnings, grade, mark, absent, projectMark
      FROM Grades t
      JOIN _ids_Grades g ON g.old = t.id
      JOIN _ids_Classes c ON c.old = t.classId
      JOIN _ids_Students s ON s.old = t.studentId`,
    `CREATE TABLE CancelledLessons_new (
      classId TEXT NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      PRIMARY KEY (classId, date)
    )`,
    `INSERT INTO CancelledLessons_new
      SELECT c.new, date FROM CancelledLessons t JOIN _ids_Classes c ON c.old = t.classId`,
    `CREATE TABLE LessonTypes_new (
      classId TEXT NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (classId, date, type)
    )`,
    `INSERT INTO LessonTypes_new
      SELECT c.new, date, type FROM LessonTypes t JOIN _ids_Classes c ON c.old = t.classId`,
    `CREATE TABLE Students2Traits_new (
      studentId TEXT NOT NULL REFERENCES Students_new(id) ON DELETE CASCADE,
      traitId TEXT NOT NULL REFERENCES Traits_new(id) ON DELETE CASCADE,
      PRIMARY KEY (studentId, traitId)
    )`,
    `INSERT INTO Students2Traits_new
      SELECT s.new, tr.new
      FROM Students2Traits t
      JOIN _ids_Students s ON s.old = t.studentId
      JOIN _ids_Traits tr ON tr.old = t.traitId`,
    `CREATE TABLE Reports_new (
      classId TEXT NOT NULL REFERENCES Classes_new(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      PRIMARY KEY (classId, date, kind)
    )`,
    `INSERT INTO Reports_new
      SELECT c.new, date, kind FROM Reports t JOIN _ids_Classes c ON c.old = t.classId`,
    `CREATE TABLE ReportGrades_new (
      classId TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      studentId TEXT NOT NULL REFERENCES Students_new(id) ON DELETE CASCADE,
      grade REAL NOT NULL,
      PRIMARY KEY (classId, date, kind, studentId),
      FOREIGN KEY (classId, date, kind)
        REFERENCES Reports_new(classId, date, kind) ON DELETE CASCADE
    )`,
    `INSERT INTO ReportGrades_new
      SELECT c.new, date, kind, s.new, grade
      FROM ReportGrades t
      JOIN _ids_Classes c ON c.old = t.classId
      JOIN _ids_Students s ON s.old = t.studentId`,
    // Children first, so dropping a parent cascades into nothing
    ...[
      "ReportGrades",
      "Reports",
      "Students2Traits",
      "LessonTypes",
      "CancelledLessons",
      "Grades",
      "Classes2Students",
      "Classes",
      "Students",
      "Traits",
      "Duties",
    ].flatMap((table) => [
      `DROP TABLE ${table}`,
      `ALTER TABLE ${table}_new RENAME TO ${table}`,
    ]),
    "CREATE UNIQUE INDEX GradesUnique ON Grades (classId, studentId, date)",
    ...["Classes", "Students", "Grades", "Traits", "Duties"].map(
      (table) => `DROP TABLE _ids_${table}`,
    ),
  ],
];
