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
 * Primary key columns of every synced table, as of migration 23. Frozen like the migrations;
 * a new synced table gets its triggers in a later migration.
 */
const SYNCED_TABLES_V23: Record<string, string[]> = {
  Classes: ["id"],
  Students: ["id"],
  Classes2Students: ["classId", "studentId"],
  Grades: ["id"],
  CancelledDays: ["date"],
  CancelledLessons: ["classId", "date"],
  LessonTypes: ["classId", "date", "type"],
  Traits: ["id"],
  Students2Traits: ["studentId", "traitId"],
  Settings: ["key"],
  SchoolYears: ["year"],
  Reports: ["classId", "date", "kind"],
  ReportGrades: ["classId", "date", "kind", "studentId"],
  Duties: ["id"],
};

/** Device settings left out of sync as of migration 23, see `DEVICE_SETTING_KEYS`. */
const DEVICE_SETTINGS_V23 =
  "'holidayCache', 'lastBackup', 'pinHash', 'colorMode', 'compactTable', 'compactTimetable'";

/** Milliseconds since 1970 in SQL, without `unixepoch('subsec')` (SQLite 3.42+). */
const NOW_MS = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";

/** Condition under which a change is recorded: sync on, and not written by the sync engine. */
const RECORDING = `(SELECT value FROM _sync_state WHERE key = 'enabled') = '1'
  AND IFNULL((SELECT value FROM _sync_state WHERE key = 'applying'), '') != '1'`;

/**
 * Outbox triggers of one table: every insert, update and delete records the primary key.
 * An update that changes the key records the old key as well, so it is synced as deleted.
 */
function outboxTriggers(table: string, pk: string[]) {
  const key = (row: string) =>
    `json_array(${pk.map((column) => `${row}.${column}`).join(", ")})`;
  const record = (row: string) =>
    `INSERT INTO _outbox (tbl, pk, changedAt) VALUES ('${table}', ${key(row)}, ${NOW_MS});`;
  const device = (row: string) =>
    table == "Settings"
      ? ` AND ${row}.key NOT IN (${DEVICE_SETTINGS_V23})`
      : "";
  return [
    `CREATE TRIGGER _outbox_${table}_insert AFTER INSERT ON ${table}
      WHEN ${RECORDING}${device("NEW")}
      BEGIN ${record("NEW")} END`,
    `CREATE TRIGGER _outbox_${table}_update AFTER UPDATE ON ${table}
      WHEN ${RECORDING}${device("NEW")}
      BEGIN
        ${record("NEW")}
        INSERT INTO _outbox (tbl, pk, changedAt)
          SELECT '${table}', ${key("OLD")}, ${NOW_MS} WHERE ${key("OLD")} != ${key("NEW")};
      END`,
    `CREATE TRIGGER _outbox_${table}_delete AFTER DELETE ON ${table}
      WHEN ${RECORDING}${device("OLD")}
      BEGIN ${record("OLD")} END`,
  ];
}

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
  // 23: change capture for sync. Triggers write the key of every changed row to `_outbox`
  // while sync is enabled; `applying` is set while the sync engine writes incoming rows.
  [
    "CREATE TABLE _sync_state (key TEXT PRIMARY KEY, value TEXT)",
    `CREATE TABLE _outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      tbl TEXT NOT NULL,
      pk TEXT NOT NULL,
      changedAt INTEGER NOT NULL
    )`,
    ...Object.entries(SYNCED_TABLES_V23).flatMap(([table, pk]) =>
      outboxTriggers(table, pk),
    ),
  ],
];
