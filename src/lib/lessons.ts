import { addDays } from "date-fns";
import type { Holiday, SchoolClass } from "../db";
import { toIsoDate } from "./dates";
import { isHoliday, isSchoolClassActive } from "./schoolYear";

/** A single lesson: a class on a specific date (`YYYY-MM-DD`). */
export type Lesson = { id: number; date: string };

/** Number of days searched for the previous or next lesson before giving up. */
const LESSON_SEARCH_DAYS = 366;

/**
 * Classes taking place on `date`, ordered by lesson; empty on weekends, holidays and
 * cancelled days (`YYYY-MM-DD`).
 */
export function getLessonsOn(
  date: Date,
  classList: SchoolClass[],
  holidayList: Holiday[],
  cancelledDays: string[],
) {
  const day = date.getDay();
  if (
    day == 0 ||
    day == 6 ||
    isHoliday(date, holidayList) ||
    cancelledDays.includes(toIsoDate(date))
  )
    return [];
  return classList
    .filter(
      (cls) => cls.day == day && isSchoolClassActive(cls, date, holidayList),
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
  holidayList: Holiday[],
  cancelledDays: string[],
  direction: 1 | -1,
): Lesson | null {
  const compare = (other: SchoolClass) =>
    (other.hour - cls.hour || other.id - cls.id) * direction;
  const sameDay = getLessonsOn(
    date,
    classList,
    holidayList,
    cancelledDays,
  ).filter((other) => compare(other) > 0);
  if (sameDay.length > 0) {
    const neighbor = direction == 1 ? sameDay[0] : sameDay[sameDay.length - 1];
    return { id: neighbor.id, date: toIsoDate(date) };
  }
  for (let offset = 1; offset <= LESSON_SEARCH_DAYS; offset++) {
    const day = addDays(date, offset * direction);
    const lessons = getLessonsOn(day, classList, holidayList, cancelledDays);
    if (lessons.length > 0) {
      const lesson = direction == 1 ? lessons[0] : lessons[lessons.length - 1];
      return { id: lesson.id, date: toIsoDate(day) };
    }
  }
  return null;
}
