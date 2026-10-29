import { addDays, format, startOfWeek, subDays } from "date-fns";

/** Formats a date as `YYYY-MM-DD` in local time. */
export const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

/** Returns the Monday of the week containing `date`. */
export const getWeekStart = (date: Date) =>
  startOfWeek(date, { weekStartsOn: 1 });

/** Moves a Saturday or Sunday to the following Monday, other days are returned unchanged. */
export function nextSchoolDay(date: Date) {
  const day = date.getDay();
  if (day == 6) return addDays(date, 2);
  if (day == 0) return addDays(date, 1);
  return date;
}

/** Most recent date on or before `from` that falls on `weekday` (1 = Monday). */
export function getLastOccurrence(weekday: number, from = new Date()) {
  return subDays(from, (from.getDay() - weekday + 7) % 7);
}
