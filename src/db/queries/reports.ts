import { and, eq } from "drizzle-orm";
import type { Report } from "../../lib/reports";
import { db } from "../client";
import { reportGrades, reports } from "../schema";

/** Returns the partial and half year grades of a class. */
export const getReports = (classId: number) =>
  db.select().from(reports).where(eq(reports.classId, classId));

/** Returns the grades set by hand in the reports of a class. */
export const getReportGrades = (classId: number) =>
  db.select().from(reportGrades).where(eq(reportGrades.classId, classId));

/** Adds a report to a lesson date. */
export const addReport = (classId: number, report: Report) =>
  db.insert(reports).values({ classId, ...report });

/** Removes a report with its grades set by hand. */
export const removeReport = (classId: number, { date, kind }: Report) =>
  db
    .delete(reports)
    .where(
      and(
        eq(reports.classId, classId),
        eq(reports.date, date),
        eq(reports.kind, kind),
      ),
    );

/** Sets a student's grade in a report by hand; `null` returns to the calculated one. */
export async function setReportGrade(
  classId: number,
  { date, kind }: Report,
  studentId: number,
  grade: number | null,
) {
  const key = { classId, date, kind, studentId };
  if (grade != null) {
    await db
      .insert(reportGrades)
      .values({ ...key, grade })
      .onConflictDoUpdate({
        target: [
          reportGrades.classId,
          reportGrades.date,
          reportGrades.kind,
          reportGrades.studentId,
        ],
        set: { grade },
      });
    return;
  }
  await db
    .delete(reportGrades)
    .where(
      and(
        eq(reportGrades.classId, classId),
        eq(reportGrades.date, date),
        eq(reportGrades.kind, kind),
        eq(reportGrades.studentId, studentId),
      ),
    );
}
