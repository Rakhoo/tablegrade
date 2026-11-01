import { addDays, parseISO } from "date-fns";
import type { GradeEntry, SchoolClass } from "../db";
import { toIsoDate } from "./dates";
import type { LessonType } from "./grades";
import {
  getClassOccurrences,
  getSchoolYearRange,
  isHoliday,
  isSchoolClassActive,
  type SchoolCalendar,
} from "./schoolYear";

/** A single lesson: a class on a specific date (`YYYY-MM-DD`). */
export type Lesson = { id: number; date: string };

/** Display names of the lesson types. */
export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  normal: "Normal",
  exam: "Klausur",
  project: "Projekt",
};

/** Everything marked as "Ausfall": dates of whole days and keys of single lessons. */
export type CancelledDates = { days: string[]; lessons: string[] };

/** Key identifying a lesson in lists of cancelled or complete lessons. */
export const lessonKey = (classId: number, date: string) =>
  `${classId}|${date}`;

/** The date (`YYYY-MM-DD`) of a lesson key. */
export const lessonDateOf = (key: string) => key.split("|")[1];

/** Number of days searched for the previous or next lesson before giving up. */
const LESSON_SEARCH_DAYS = 366;

/**
 * Classes taking place on `date`, ordered by lesson; empty on weekends, holidays and
 * cancelled days, and without cancelled lessons.
 */
export function getLessonsOn(
  date: Date,
  classList: SchoolClass[],
  calendar: SchoolCalendar,
  cancelled: CancelledDates,
) {
  const day = date.getDay();
  const iso = toIsoDate(date);
  if (
    day == 0 ||
    day == 6 ||
    isHoliday(date, calendar) ||
    cancelled.days.includes(iso)
  )
    return [];
  return classList
    .flatMap(getClassOccurrences)
    .filter(
      (cls) =>
        cls.day == day &&
        isSchoolClassActive(cls, date, calendar) &&
        !cancelled.lessons.includes(lessonKey(cls.id, iso)),
    )
    .sort((a, b) => a.hour - b.hour || a.id - b.id);
}

/**
 * Finds the lesson before (`-1`) or after (`1`) a class on a date: the neighboring class of
 * the same day, otherwise the last/first class of the nearest earlier/later day with lessons.
 */
export function getAdjacentLesson(
  cls: SchoolClass,
  date: Date,
  classList: SchoolClass[],
  calendar: SchoolCalendar,
  cancelled: CancelledDates,
  direction: 1 | -1,
): Lesson | null {
  const current =
    getClassOccurrences(cls).find((lesson) => lesson.day == date.getDay()) ??
    cls;
  const compare = (other: SchoolClass) =>
    (other.hour - current.hour || other.id - current.id) * direction;
  const sameDay = getLessonsOn(date, classList, calendar, cancelled).filter(
    (other) => compare(other) > 0,
  );
  if (sameDay.length > 0) {
    const neighbor = direction == 1 ? sameDay[0] : sameDay[sameDay.length - 1];
    return { id: neighbor.id, date: toIsoDate(date) };
  }
  for (let offset = 1; offset <= LESSON_SEARCH_DAYS; offset++) {
    const day = addDays(date, offset * direction);
    const lessons = getLessonsOn(day, classList, calendar, cancelled);
    if (lessons.length > 0) {
      const lesson = direction == 1 ? lessons[0] : lessons[lessons.length - 1];
      return { id: lesson.id, date: toIsoDate(day) };
    }
  }
  return null;
}

/**
 * Dates (`YYYY-MM-DD`) of all lessons of a class in its school year part up to `until`,
 * without holidays and cancelled days or lessons, oldest first.
 */
export function getLessonDates(
  cls: SchoolClass,
  calendar: SchoolCalendar,
  cancelled: CancelledDates,
  until = new Date(),
) {
  const { start, end } = getSchoolYearRange(cls.year, cls.part, calendar);
  const dates: string[] = [];
  for (let day = start; day < end && day <= until; day = addDays(day, 1)) {
    if (getLessonsOn(day, [cls], calendar, cancelled).length > 0) {
      dates.push(toIsoDate(day));
    }
  }
  return dates;
}

/**
 * Entries that lose their lesson under a calendar: outside the class's school year part or on
 * a holiday, e.g. after moving the start of the second half.
 */
export function getOrphanedEntries(
  entries: GradeEntry[],
  classes: SchoolClass[],
  calendar: SchoolCalendar,
) {
  return entries.filter((entry) => {
    const cls = classes.find((other) => other.id == entry.classId);
    const date = parseISO(entry.date);
    return (
      !cls ||
      !isSchoolClassActive(cls, date, calendar) ||
      isHoliday(date, calendar)
    );
  });
}
