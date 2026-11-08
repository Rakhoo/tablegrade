import {
  isExamDay,
  MARK_FIELD,
  MARK_KIND,
  type LessonType,
  type MarkKind,
} from "./grades";
import type { GradeTarget } from "./gradeTools";
import { LESSON_TYPE_LABELS, LESSON_TYPE_ORDER } from "./lessons";

/** The types of a lesson on a date of the class; none for a regular lesson. */
export type TypesOf = (date: string) => LessonType[];

/** Exam or project chains: the dates of its chain for each date in one, oldest first. */
export type LessonChains = Record<MarkKind, Map<string, string[]>>;

/** The follow-up lesson types and the type each continues. */
const CONTINUES = { retake: "exam", extension: "project" } as const;

export type FollowUpType = keyof typeof CONTINUES;

/**
 * Groups the exams and projects of a class with their follow-ups: a retake continues the latest
 * exam before it, an extension the latest project.
 * @param dates Lesson dates of the class; only those with types matter.
 */
export function getLessonChains(dates: string[], typesOf: TypesOf) {
  const chains: LessonChains = { exam: new Map(), project: new Map() };
  const latest: Partial<Record<MarkKind, string[]>> = {};
  for (const date of [...dates].sort()) {
    for (const type of typesOf(date)) {
      const kind = MARK_KIND[type];
      if (type == "exam" || type == "project") {
        latest[kind] = [date];
        chains[kind].set(date, latest[kind]);
      } else {
        const chain = latest[kind];
        if (chain) {
          chain.push(date);
          chains[kind].set(date, chain);
        }
      }
    }
  }
  return chains;
}

/**
 * Whether a student's mark on `date` is closed: it lies on another date of the same exam or
 * project already, earlier or in a follow-up.
 */
export const isMarkLocked = (
  chains: Map<string, string[]>,
  date: string,
  hasMark: (date: string) => boolean,
) => !!chains.get(date)?.some((other) => other != date && hasMark(other));

/**
 * Whether `date` can get a follow-up: the latest exam (for a retake) or project (for an
 * extension) before it, with its follow-ups so far, still lacks a mark of a student.
 * @param hasMark Whether a student has a mark of that kind on a date.
 */
export function canBeFollowUp(
  type: FollowUpType,
  date: string,
  dates: string[],
  typesOf: TypesOf,
  studentIds: number[],
  hasMark: (studentId: number, date: string) => boolean,
) {
  const base = CONTINUES[type];
  const before = dates.filter((other) => other < date).sort();
  const baseDate = before
    .filter((other) => typesOf(other).includes(base))
    .at(-1);
  if (!baseDate) return false;
  const chain = getLessonChains(before, typesOf)[base].get(baseDate)!;
  return studentIds.some((id) => !chain.some((other) => hasMark(id, other)));
}

/**
 * Label of a lesson type: a project with extensions counts its parts ("Projekt 1/2",
 * "Projekt 2/2"), everything else has its plain label.
 */
export function getLessonTypeLabel(
  chains: LessonChains,
  date: string,
  type: LessonType,
) {
  const chain = chains.project.get(date);
  if (MARK_KIND[type] == "project" && chain && chain.length > 1) {
    return `Projekt ${chain.indexOf(date) + 1}/${chain.length}`;
  }
  return LESSON_TYPE_LABELS[type];
}

/** What completeness needs of an entry. */
export type CompletionEntry = {
  studentId: number;
  date: string;
  grade: number | null;
  mark: number | null;
  projectMark: number | null;
  absent: boolean;
};

/**
 * Whether a lesson is complete, separately for its parts:
 * - `lesson`: every student has an oral grade or "excused"; on an exam day a mark instead. In a
 *   retake only the students with their exam mark already get oral grades.
 * - `retake` and `project`: every student without that mark on another date of the exam or
 *   project has one here. Those writing a retake take no part in a project on the same day.
 * For marks (exam, retake, project) "excused" counts as no entry: the mark is still due.
 */
export function getLessonCompletion(
  date: string,
  types: LessonType[],
  studentIds: number[],
  entries: CompletionEntry[],
  chains: LessonChains,
) {
  const entryOf = (id: number, day: string) =>
    entries.find((entry) => entry.studentId == id && entry.date == day);
  const lockedIn = (kind: MarkKind, id: number) =>
    isMarkLocked(
      chains[kind],
      date,
      (day) => entryOf(id, day)?.[MARK_FIELD[kind]] != null,
    );
  const settled = (
    due: number[],
    value: (entry: CompletionEntry) => number | null,
    excusedCounts = false,
  ) =>
    studentIds.length > 0 &&
    due.every((id) => {
      const entry = entryOf(id, date);
      return (
        !!entry && ((excusedCounts && entry.absent) || value(entry) != null)
      );
    });

  if (isExamDay(types)) {
    const complete = settled(
      studentIds.filter((id) => !lockedIn("exam", id)),
      (entry) => entry.mark,
    );
    return { lesson: complete, retake: false, project: false };
  }
  const retakers = studentIds.filter((id) => !lockedIn("exam", id));
  const hasRetake = types.includes("retake");
  const hasProject = types.some((type) => MARK_KIND[type] == "project");
  return {
    lesson: settled(
      hasRetake
        ? studentIds.filter((id) => !retakers.includes(id))
        : studentIds,
      (entry) => entry.grade,
      true,
    ),
    retake: hasRetake && settled(retakers, (entry) => entry.mark),
    // Those writing the retake take no part in the project that day
    project:
      hasProject &&
      settled(
        studentIds.filter(
          (id) =>
            !lockedIn("project", id) && !(hasRetake && retakers.includes(id)),
        ),
        (entry) => entry.projectMark,
      ),
  };
}

/**
 * The rules of a class's exams and projects with their follow-ups, shared by the seating plan
 * and the overview: a mark on one date of a chain closes the others for that student, and those
 * writing a retake take part in nothing else that day.
 * @param dates Lesson dates of the class; only those with types matter.
 * @param entries All grade entries of the class.
 */
export function createMarkRules(
  dates: string[],
  typesOf: TypesOf,
  studentIds: number[],
  entries: CompletionEntry[],
) {
  const chains = getLessonChains(dates, typesOf);
  const byKey = new Map(
    entries.map((entry) => [`${entry.studentId}|${entry.date}`, entry]),
  );
  const markOf = (kind: MarkKind, studentId: number, date: string) =>
    byKey.get(`${studentId}|${date}`)?.[MARK_FIELD[kind]] ?? null;
  const hasMark = (kind: MarkKind, studentId: number, date: string) =>
    markOf(kind, studentId, date) != null;
  /** Whether a student's mark of `kind` on `date` lies on another date of its chain. */
  const isLocked = (kind: MarkKind, studentId: number, date: string) =>
    isMarkLocked(chains[kind], date, (other) =>
      hasMark(kind, studentId, other),
    );
  /** On a retake day, whether a student writes it: without the exam mark on another date. */
  const isRetaker = (studentId: number, date: string) =>
    typesOf(date).includes("retake") && !isLocked("exam", studentId, date);

  return {
    chains,
    isLocked,
    isRetaker,
    /**
     * Whether a part of a student's entry on `date` is closed: its mark lies on another date,
     * or it is a retaker's oral grade or project mark.
     */
    isClosed: (studentId: number, date: string, target: GradeTarget) =>
      target == "mark" || isExamDay(typesOf(date))
        ? isLocked("exam", studentId, date)
        : target == "projectMark"
          ? isLocked("project", studentId, date) || isRetaker(studentId, date)
          : isRetaker(studentId, date),
    /** The mark a student got on another date of the chain `date` belongs to. */
    chainMark: (kind: MarkKind, studentId: number, date: string) =>
      chains[kind]
        .get(date)
        ?.map((other) => markOf(kind, studentId, other))
        .find((mark) => mark != null) ?? null,
    /** Whether the lesson on `date` is complete, separately for its parts. */
    completion: (date: string) =>
      getLessonCompletion(date, typesOf(date), studentIds, entries, chains),
    /** The types `date` can get: its own, and follow-ups only after an incomplete exam or project. */
    availableTypes: (date: string) =>
      LESSON_TYPE_ORDER.filter(
        (type) =>
          type == "exam" ||
          type == "project" ||
          typesOf(date).includes(type) ||
          canBeFollowUp(
            type as FollowUpType,
            date,
            dates,
            typesOf,
            studentIds,
            (studentId, day) => hasMark(MARK_KIND[type], studentId, day),
          ),
      ),
    /** Label of a type on `date`, counting the parts of a project. */
    typeLabel: (date: string, type: LessonType) =>
      getLessonTypeLabel(chains, date, type),
  };
}

/** The mark rules of a class, see `createMarkRules`. */
export type MarkRules = ReturnType<typeof createMarkRules>;
