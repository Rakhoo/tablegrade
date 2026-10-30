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

/** Short name shown on the seating plan: the nickname if set, otherwise the first name. */
export const getStudentLabel = (
  student: StudentName & { nickname: string | null },
) => student.nickname || student.firstName || student.lastName;
