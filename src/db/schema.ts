import { relations } from "drizzle-orm";
import {
  int,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** School holidays, cached from the mehr-schulferien.de API. Dates are `YYYY-MM-DD`, `end` is inclusive. */
export const holidays = sqliteTable("Holidays", {
  id: int("id").primaryKey(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  summer: int("summer", { mode: "boolean" }),
  /** `true` for public holidays (Feiertage), `false` for school vacations (Ferien). */
  publicHoliday: int("publicHoliday", { mode: "boolean" }),
});

/** A recurring weekly lesson of one subject in one class for a school year (or half of it). */
export const schoolClasses = sqliteTable("Classes", {
  id: int("id").primaryKey({ autoIncrement: true }),
  subject: text("subject").notNull(),
  /** Grade level: "5"…"10" or "EF" | "Q1" | "Q2". */
  number: text("number").notNull(),
  /** Class letter, only used for levels 5–10. */
  letter: text("letter"),
  /** TimetablePage year in which the school year starts (2026 = "2026/27"). */
  year: int("year").notNull(),
  /** "1" = first half, "2" = second half, "full" = whole school year. */
  part: text("part").$type<"1" | "2" | "full">().notNull(),
  /** Weekday, 1 = Monday … 5 = Friday. */
  day: int("day").notNull(),
  /** Lesson number of the day, starting at 1. */
  hour: int("hour").notNull(),
  double: int("double", { mode: "boolean" }).notNull(),
});

export const schoolClassesRelations = relations(schoolClasses, ({ many }) => ({
  memberships: many(classStudents),
}));

export const students = sqliteTable("Students", {
  id: int("id").primaryKey({ autoIncrement: true }),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  /** Name to show instead of the first name. */
  nickname: text("nickname"),
  /** Photo as base64 data URL. */
  image: text("image"),
});

export const studentsRelations = relations(students, ({ many }) => ({
  memberships: many(classStudents),
}));

/** Class membership of a student, including the seat in the classroom grid. */
export const classStudents = sqliteTable(
  "Classes2Students",
  {
    classId: int("classId")
      .notNull()
      .references(() => schoolClasses.id, { onDelete: "cascade" }),
    studentId: int("studentId")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Column of the seat's top left cell in half seats, `null` if the student has no seat. */
    x: int("x"),
    /** Row of the seat's top left cell in half seats, `null` if the student has no seat. */
    y: int("y"),
  },
  (table) => [primaryKey({ columns: [table.classId, table.studentId] })],
);

export const classStudentsRelations = relations(classStudents, ({ one }) => ({
  class: one(schoolClasses, {
    fields: [classStudents.classId],
    references: [schoolClasses.id],
  }),
  student: one(students, {
    fields: [classStudents.studentId],
    references: [students.id],
  }),
}));

/** Symbol grade, comment and warnings of one student for one lesson date of a class. */
export const grades = sqliteTable(
  "Grades",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    /** Key of a symbol from `GRADES` in `src/lib/grades.ts`. */
    grade: text("grade"),
    comment: text("comment"),
    /** Number of warnings in this lesson: 0 = none, 1 = first, 2 = second warning. */
    warnings: int("warnings").notNull().default(0),
    /** Lesson date as `YYYY-MM-DD`. */
    date: text("date").notNull(),
    classId: int("classId")
      .notNull()
      .references(() => schoolClasses.id, { onDelete: "cascade" }),
    studentId: int("studentId")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("GradesUnique").on(table.classId, table.studentId, table.date),
  ],
);

export const gradesRelations = relations(grades, ({ one }) => ({
  class: one(schoolClasses, {
    fields: [grades.classId],
    references: [schoolClasses.id],
  }),
  student: one(students, {
    fields: [grades.studentId],
    references: [students.id],
  }),
}));

/** Selectable student properties (ADHS, LRS, …), seeded by the migrations. */
export const traits = sqliteTable("Traits", {
  id: int("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

/** Assignment of traits to students. */
export const studentTraits = sqliteTable(
  "Students2Traits",
  {
    studentId: int("studentId")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    traitId: int("traitId")
      .notNull()
      .references(() => traits.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.traitId] })],
);

/** Days marked as "Ausfall" by the teacher: no lessons take place and nothing is graded. */
export const cancelledDays = sqliteTable("CancelledDays", {
  /** Date as `YYYY-MM-DD`. */
  date: text("date").primaryKey(),
});

export type Holiday = typeof holidays.$inferSelect;
export type SchoolClass = typeof schoolClasses.$inferSelect;
export type SchoolYearPart = SchoolClass["part"];
export type Student = typeof students.$inferSelect;
export type GradeEntry = typeof grades.$inferSelect;
export type Trait = typeof traits.$inferSelect;
