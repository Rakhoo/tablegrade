/** A grade column of a course in a "LET-Helfer" file. */
export type LetFileColumn = { id: string; type: string; label: string };

/** A student of a course in a "LET-Helfer" file; other fields stay as they are. */
export type LetFileStudent = {
  id: string;
  vorname: string;
  initiale: string;
  /** Marks by column id. */
  grades: Record<string, string>;
  solei: string;
  [field: string]: unknown;
};

/** A course in a "LET-Helfer" file; other fields stay as they are. */
export type LetFileCourse = {
  id: string;
  name: string;
  fach: string;
  columns: LetFileColumn[];
  students: LetFileStudent[];
  [field: string]: unknown;
};

/** A "LET-Helfer" file; other fields stay as they are. */
export type LetFile = { courses: LetFileCourse[]; [field: string]: unknown };

/** Compares items alphabetically by a text, numbers by value ("5a" before "10a"). */
export const byText =
  <Item>(getText: (item: Item) => string) =>
  (a: Item, b: Item) =>
    getText(a).localeCompare(getText(b), "de", { numeric: true });

const normalize = (text: unknown) =>
  String(text ?? "")
    .trim()
    .toLocaleLowerCase("de");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == "object" && value != null && !Array.isArray(value);

/**
 * Reads a file of the "LET-Helfer", filling in missing lists so it can be merged.
 * @throws An error with a German message if it is no such file.
 */
export function parseLetFile(text: string): LetFile {
  let content: unknown;
  try {
    content = JSON.parse(text);
  } catch {
    throw new Error("Die Datei ist keine gültige JSON-Datei.");
  }
  if (
    !isObject(content) ||
    content.app != "elternsprechtag-helfer" ||
    !Array.isArray(content.courses)
  ) {
    throw new Error("Die Datei stammt nicht vom LET-Helfer.");
  }
  return {
    ...content,
    courses: content.courses.filter(isObject).map((course) => ({
      ...course,
      id: String(course.id ?? crypto.randomUUID()),
      name: String(course.name ?? ""),
      fach: String(course.fach ?? ""),
      columns: Array.isArray(course.columns) ? course.columns : [],
      students: (Array.isArray(course.students) ? course.students : [])
        .filter(isObject)
        .map((student) => ({
          ...student,
          id: String(student.id ?? crypto.randomUUID()),
          vorname: String(student.vorname ?? ""),
          initiale: String(student.initiale ?? ""),
          grades: isObject(student.grades)
            ? (student.grades as Record<string, string>)
            : {},
          solei: String(student.solei ?? ""),
        })),
    })),
  };
}

/** Display name of a course in a file, e.g. "7b Mathematik". */
export const formatLetCourse = (course: LetFileCourse) =>
  `${course.name} ${course.fach}`.trim();

/**
 * The course of a file a class goes into: the one with the same class and subject, else the
 * first of the same class, else the first one; never one in `taken`.
 * @returns Its id, or `null` (a new course) if all are taken.
 */
export function findLetTarget(
  courses: LetFileCourse[],
  name: string,
  subject: string,
  taken: string[],
) {
  const free = courses.filter((course) => !taken.includes(course.id));
  const sameClass = free.filter(
    (course) => normalize(course.name) == normalize(name),
  );
  return (
    (
      sameClass.find(
        (course) => normalize(course.fach) == normalize(subject),
      ) ??
      sameClass[0] ??
      free[0]
    )?.id ?? null
  );
}

/**
 * The student of a course a new one is merged into: same first name and initial, else the only
 * one with that first name; never one already matched.
 * @returns Its index, or -1 for a new student.
 */
function findStudent(
  students: LetFileStudent[],
  student: LetFileStudent,
  matched: Set<number>,
) {
  const candidates = students.flatMap((other, index) =>
    !matched.has(index) &&
    normalize(other.vorname) == normalize(student.vorname)
      ? [index]
      : [],
  );
  return (
    candidates.find(
      (index) =>
        normalize(students[index].initiale) == normalize(student.initiale),
    ) ?? (candidates.length == 1 ? candidates[0] : -1)
  );
}

/**
 * Merges a freshly built course into one of a file: columns with the same type and label are
 * reused, the others appended; students get the new marks and `solei` where they have one.
 * Everything the export does not fill (other columns, remarks, praise, …) stays untouched.
 */
export function mergeLetCourse(
  existing: LetFileCourse,
  built: LetFileCourse,
  now: string,
): LetFileCourse {
  const columns = [...existing.columns];
  const columnIds = new Map<string, string>();
  for (const column of built.columns) {
    const match = columns.find(
      (other) =>
        other.type == column.type &&
        normalize(other.label) == normalize(column.label),
    );
    if (!match) columns.push(column);
    columnIds.set(column.id, match?.id ?? column.id);
  }
  /** Marks keyed by the merged column ids, without empty ones if `skipEmpty`. */
  const remap = (grades: Record<string, string>, skipEmpty: boolean) =>
    Object.fromEntries(
      Object.entries(grades)
        .filter(([, value]) => !skipEmpty || value != "")
        .map(([id, value]) => [columnIds.get(id) ?? id, value]),
    );

  const students = [...existing.students];
  const matched = new Set<number>();
  for (const student of built.students) {
    const index = findStudent(students, student, matched);
    if (index < 0) {
      matched.add(students.length);
      students.push({ ...student, grades: remap(student.grades, false) });
      continue;
    }
    matched.add(index);
    const current = students[index];
    students[index] = {
      ...current,
      grades: { ...current.grades, ...remap(student.grades, true) },
      solei: student.solei || current.solei,
    };
  }
  return {
    ...existing,
    columns,
    students: students.sort(
      byText((student) => `${student.vorname} ${student.initiale}`),
    ),
    updated: now,
    lastFileSave: now,
  };
}
