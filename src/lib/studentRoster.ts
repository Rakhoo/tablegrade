import type { RosterEntry } from "../db";

/** A student coming from a pasted list or a PDF; `image` is only set by the PDF import. */
export type IncomingStudent = Pick<RosterEntry, "firstName" | "lastName"> & {
  image?: string | null;
  /** Only used if the student is new to the roster. */
  nickname?: string | null;
};

/** Reduces a student to the fields saved with a roster, dropping seat or UI data. */
export const toRosterEntry = ({
  id,
  firstName,
  lastName,
  nickname,
  image,
  traitIds,
  seat,
}: RosterEntry): RosterEntry => ({
  id,
  firstName,
  lastName,
  nickname,
  image,
  traitIds,
  seat,
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

const normalize = (text: string) => text.trim().toLocaleLowerCase("de");

/** Unique key of a student within a class: first and last name, ignoring case. */
const studentKey = ({ firstName, lastName }: IncomingStudent) =>
  normalize(`${firstName.trim()}|${lastName.trim()}`);

/** First of several given names ("Anna Maria", "Anna-Maria"), or the only one. */
const getGivenName = (firstName: string) => firstName.trim().split(/[\s-]+/)[0];

/** Nickname for a newly imported student: the first given name, if there are several. */
export function getImportNickname(firstName: string) {
  const givenName = getGivenName(firstName);
  return givenName == firstName.trim() ? null : givenName;
}

/**
 * Merges incoming students into a roster by their key. Known students only get a new photo,
 * so nickname and traits stay untouched; unknown students are appended via `createRow`.
 * Every roster row matches once, so namesakes in the incoming data stay separate students.
 * @returns The new roster, the number of added and matched students, and the roster
 * students missing in the incoming data (they stay in the roster).
 */
export function mergeStudents<Row extends RosterEntry>(
  roster: Row[],
  incoming: IncomingStudent[],
  createRow: (entry: RosterEntry) => Row,
) {
  const rows = [...roster];
  const matched = new Set<number>();
  let added = 0;
  for (const student of incoming) {
    const key = studentKey(student);
    const index = roster.findIndex(
      (row, rowIndex) => !matched.has(rowIndex) && studentKey(row) == key,
    );
    if (index < 0) {
      rows.push(
        createRow({
          firstName: student.firstName,
          lastName: student.lastName,
          nickname: student.nickname ?? null,
          image: student.image ?? null,
          traitIds: [],
        }),
      );
      added++;
    } else {
      matched.add(index);
      if (student.image) rows[index] = { ...rows[index], image: student.image };
    }
  }
  return {
    rows,
    added,
    matched: matched.size,
    missing: roster.length - matched.size,
  };
}

/** Shortest start of a last name that differs from all other last names, with "." if cut. */
function getLastNamePrefix(lastName: string, others: string[]) {
  const name = lastName.trim();
  for (let length = 1; length < name.length; length++) {
    const start = normalize(name.slice(0, length));
    if (others.every((other) => normalize(other).slice(0, length) != start)) {
      return `${name.slice(0, length)}.`;
    }
  }
  return name;
}

/**
 * Prefills nicknames for students sharing their (first) given name: "Anna M.", or more of the
 * last name until it differs ("Anna Mü.", "Anna Me."). Namesakes with the same last name are
 * numbered in roster order ("Anna 1", "Anna 2"). Other nicknames stay untouched, a nickname
 * that is just the given name counts as unset, as it does not tell the students apart.
 */
export function fillNicknames<Row extends RosterEntry>(rows: Row[]) {
  const nicknames = new Map<Row, string>();
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const givenName = normalize(getGivenName(row.firstName));
    groups.set(givenName, [...(groups.get(givenName) ?? []), row]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const open = group.filter(
      (row) =>
        !row.nickname ||
        normalize(row.nickname) == normalize(getGivenName(row.firstName)),
    );
    const lastNames = group
      .map((row) => row.lastName.trim())
      .filter((lastName) => lastName);
    for (const row of open) {
      const givenName = getGivenName(row.firstName);
      const sameName = open.filter(
        (other) => normalize(other.lastName) == normalize(row.lastName),
      );
      if (sameName.length > 1) {
        nicknames.set(row, `${givenName} ${sameName.indexOf(row) + 1}`);
      } else if (row.lastName.trim()) {
        const others = lastNames.filter(
          (lastName) => normalize(lastName) != normalize(row.lastName),
        );
        nicknames.set(
          row,
          `${givenName} ${getLastNamePrefix(row.lastName, others)}`,
        );
      }
    }
  }
  return rows.map((row) => {
    const nickname = nicknames.get(row);
    return nickname ? { ...row, nickname } : row;
  });
}
