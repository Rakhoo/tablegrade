import type { SchoolClass } from "../db";

/** Display name of a class, e.g. "5a", "7mix", "Q1" or "Mix". */
export const formatClassName = (cls: Pick<SchoolClass, "number" | "letter">) =>
  cls.number + (cls.letter ?? "");

/** Display label of a school year, e.g. "2026/27". */
export const formatSchoolYear = (year: number) =>
  `${year}/${String((year + 1) % 100).padStart(2, "0")}`;

type StudentName = { firstName: string; lastName: string };

/** Full name of a student; the last name is optional. */
export const formatStudentName = ({ firstName, lastName }: StudentName) =>
  `${firstName} ${lastName}`.trim();

/** Sorts students alphabetically by "Vorname Nachname". */
export const compareStudents = (a: StudentName, b: StudentName) =>
  formatStudentName(a).localeCompare(formatStudentName(b), "de");

/** Short name shown on the seating plan: the nickname if set, otherwise the first name. */
export const getStudentLabel = (
  student: StudentName & { nickname: string | null },
) => student.nickname || student.firstName || student.lastName;

/** The first words of a comment, e.g. for a speech bubble. */
export function getCommentPreview(comment: string, words = 6) {
  const parts = comment.trim().split(/\s+/);
  return parts.length > words
    ? `${parts.slice(0, words).join(" ")} …`
    : parts.join(" ");
}
