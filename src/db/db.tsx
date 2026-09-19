import { SQLocalDrizzle } from "sqlocal/drizzle";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { sqliteTable, int, text, primaryKey } from "drizzle-orm/sqlite-core";
import { getTableColumns, getTableName, relations } from "drizzle-orm";

export const holidays = sqliteTable("Holidays", {
  id: int("id").primaryKey(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  summer: int("summer", { mode: "boolean" }),
});

export const classes = sqliteTable("Classes", {
  id: int("id").primaryKey({ autoIncrement: true }),
  subject: text("subject").notNull(),
  number: text("number").notNull(),
  letter: text("letter"),
  year: text("year").notNull(),
  part: text("part").notNull(),
  day: int("day").notNull(),
  hour: int("hour").notNull(),
  double: int("double", { mode: "boolean" }).notNull(),
});

export const classesRelations = relations(classes, ({ many }) => ({
  students: many(students),
}));

export const students = sqliteTable("Students", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nickname: text("nickname"),
  image: text("image"),
});

export const studentsRelations = relations(students, ({ many }) => ({
  class: many(classes),
}));

export const classes2Students = sqliteTable(
  "Classes2Students",
  {
    classId: int("classId")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: int("studentId")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.classId, table.studentId] })],
);

export const classes2StudentsRelations = relations(
  classes2Students,
  ({ one }) => ({
    classId: one(classes, {
      fields: [classes2Students.classId],
      references: [classes.id],
    }),
    studentId: one(students, {
      fields: [classes2Students.studentId],
      references: [students.id],
    }),
  }),
);

export const grades = sqliteTable("Grades", {
  id: int("id").primaryKey({ autoIncrement: true }),
  grade: text("grade"),
  date: text("date"),
  classId: int("classId")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  studentId: int("studentId")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
});

export const gradesRelations = relations(grades, ({ one }) => ({
  classId: one(classes, {
    fields: [grades.classId],
    references: [classes.id],
  }),
  studentId: one(students, {
    fields: [grades.studentId],
    references: [students.id],
  }),
}));

const allTables = [holidays, classes, students, classes2Students, grades];

// Initialize SQLocalDrizzle and pass the driver to Drizzle
const { driver } = new SQLocalDrizzle({
  databasePath: "tablegrade.sqlite3",
  onConnect: (reason) => {
    if (reason == "initial") {
      //deleteDatabaseFile()
      allTables.forEach(
        async (table) =>
          await db.run(
            `CREATE TABLE IF NOT EXISTS ${getTableName(table)} (\n  ` +
              Object.values(getTableColumns(table))
                .map(
                  (col) =>
                    `${col.name} ${col.getSQLType()}` +
                    (col.notNull && !col.primary ? " NOT NULL" : "") +
                    (col.hasDefault && (col.default || col.defaultFn)
                      ? ` DEFAULT ${col.default || (col.defaultFn && col.defaultFn())}`
                      : "") +
                    (col.primary
                      ? " PRIMARY KEY" +
                        (getTableName(table) != "Holidays"
                          ? " AUTOINCREMENT"
                          : "")
                      : ""),
                )
                .join(",\n  ") +
              ((getTableName(table).includes("2") &&
                `,\n  PRIMARY KEY (${Object.values(getTableColumns(table))
                  .map((col) => col.name)
                  .join(", ")})`) ||
                "") +
              ((table as any)[Symbol.for("drizzle:SQLiteInlineForeignKeys")]
                .length > 0
                ? ",\n  " +
                  (table as any)[Symbol.for("drizzle:SQLiteInlineForeignKeys")]
                    .map((ref: any) => ref.reference())
                    .map(
                      (ref: any) =>
                        `FOREIGN KEY(${ref.columns[0].name}) REFERENCES ${getTableName(ref.foreignTable)}(${ref.foreignColumns[0].name})`,
                    )
                    .join("\n  ")
                : "") +
              "\n)",
          ),
      );
    }
  },
});
export const db = drizzle(driver);
