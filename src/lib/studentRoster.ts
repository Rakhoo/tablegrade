import type { RosterEntry } from "../db";

/** A student coming from a pasted list or a PDF; `image` is only set by the PDF import. */
export type IncomingStudent = Pick<RosterEntry, "firstName" | "lastName"> & {
  image?: string | null;
};

/** Reduces a student to the fields saved with a roster, dropping seat or UI data. */
export const toRosterEntry = ({
  id,
  firstName,
  lastName,
  nickname,
  image,
  traitIds,
}: RosterEntry): RosterEntry => ({
  id,
  firstName,
  lastName,
  nickname,
  image,
  traitIds,
});

/** Splits a name at the first space: first name, the rest is the last name. */
export function splitName(name: string): IncomingStudent {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

/** Parses a pasted list with one student per non-empty line. */
export const parseStudentList = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.trim())
    .map(splitName);

/** Unique key of a student within a class: first and last name, ignoring case. */
const studentKey = ({ firstName, lastName }: IncomingStudent) =>
  `${firstName.trim()}|${lastName.trim()}`.toLocaleLowerCase("de");

/**
 * Merges incoming students into a roster by their key. Known students only get a new photo,
 * so nickname and traits stay untouched; unknown students are appended via `createRow`.
 * @returns The new roster, the number of added and matched students, and the roster
 * students missing in the incoming data (they stay in the roster).
 */
export function mergeStudents<Row extends RosterEntry>(
  roster: Row[],
  incoming: IncomingStudent[],
  createRow: (entry: RosterEntry) => Row,
) {
  const rows = [...roster];
  const matched = new Set<string>();
  let added = 0;
  for (const student of incoming) {
    const key = studentKey(student);
    const index = rows.findIndex((row) => studentKey(row) == key);
    if (index < 0) {
      rows.push(
        createRow({
          firstName: student.firstName,
          lastName: student.lastName,
          nickname: null,
          image: student.image ?? null,
          traitIds: [],
        }),
      );
      added++;
    } else if (student.image) {
      rows[index] = { ...rows[index], image: student.image };
    }
    matched.add(key);
  }
  const missing = roster.filter((row) => !matched.has(studentKey(row))).length;
  return { rows, added, matched: matched.size - added, missing };
}

/**
 * Prefills the nickname "Vorname N." for students sharing their first name, unless they
 * already have a nickname or no last name to tell them apart.
 */
export function fillNicknames<Row extends RosterEntry>(rows: Row[]) {
  const counts = new Map<string, number>();
  const firstNameOf = (row: Row) =>
    row.firstName.trim().toLocaleLowerCase("de");
  for (const row of rows) {
    counts.set(firstNameOf(row), (counts.get(firstNameOf(row)) ?? 0) + 1);
  }
  return rows.map((row) =>
    (counts.get(firstNameOf(row)) ?? 0) > 1 && !row.nickname && row.lastName
      ? { ...row, nickname: `${row.firstName} ${row.lastName.trim()[0]}.` }
      : row,
  );
}
