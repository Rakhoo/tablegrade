import { addDays, parseISO } from "date-fns";
import type { Holiday, SchoolClass, SchoolYearPart } from "../db";
import { toIsoDate } from "./dates";

/** Weekday names, index 0 = Monday. */
export const WEEKDAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

/** Earliest school year (start year) with holidays in the API. */
export const FIRST_SCHOOL_YEAR = 2019;

/** Latest school year the holiday API is assumed to know; it may turn out to know more. */
export const getBaseLastSchoolYear = (today = new Date()) =>
  today.getFullYear() + 2;

/** First day the calendar can show. */
export const CALENDAR_START = new Date(FIRST_SCHOOL_YEAR, 7, 1);

/** Last day the calendar can show: the end of the latest school year possible or in use. */
export const getCalendarEnd = (years: number[]) =>
  new Date(Math.max(getBaseLastSchoolYear(), ...years) + 1, 8, 30);

/** Whether the holidays contain the summer holidays ending in `year`. */
export const hasSummerHolidays = (holidays: Holiday[], year: number) =>
  holidays.some(
    (holiday) => holiday.summer && holiday.end.startsWith(String(year)),
  );

/** Ids of estimates are negative years; -1 is the fixed summer of 2019, which stays. */
const PROVISIONAL_ID_LIMIT = -1;

/** Days between two summer holidays' estimates: whole weeks, so weekdays stay the same. */
const DAYS_PER_YEAR = 364;

/**
 * Adds estimated summer holidays for school years whose start or end the API does not know
 * yet: the latest known ones, moved by whole years. Their ids are the negative year.
 */
export function addProvisionalSummers(holidays: Holiday[], years: number[]) {
  const result = [...holidays];
  const needed = [...new Set(years.flatMap((year) => [year, year + 1]))].sort();
  for (const year of needed) {
    if (hasSummerHolidays(result, year)) continue;
    const known = result
      .filter((holiday) => holiday.summer)
      .sort((a, b) => a.end.localeCompare(b.end))
      .at(-1);
    if (!known) continue;
    const yearsAhead = year - Number(known.end.slice(0, 4));
    if (yearsAhead <= 0) continue;
    const move = (date: string) =>
      toIsoDate(addDays(parseISO(date), yearsAhead * DAYS_PER_YEAR));
    result.push({
      ...known,
      id: -year,
      start: move(known.start),
      end: move(known.end),
    });
  }
  return result;
}

/** Whether holidays contain estimated summer holidays, see `addProvisionalSummers`. */
export const hasProvisionalSummers = (holidays: Holiday[]) =>
  holidays.some((holiday) => holiday.id < PROVISIONAL_ID_LIMIT);

export const SCHOOL_YEAR_PART_LABELS: Record<SchoolYearPart, string> = {
  "1": "1. Halbjahr",
  "2": "2. Halbjahr",
  full: "Ganzes Jahr",
};

/** Whether `date` lies inside any holiday period. */
export function isHoliday(date: Date, calendar: SchoolCalendar) {
  return !!getHoliday(date, calendar);
}

/** The holiday period containing `date`; vacations take precedence over public holidays. */
export function getHoliday(date: Date, calendar: SchoolCalendar) {
  const iso = toIsoDate(date);
  const matching = calendar.holidays.filter(
    (holiday) => holiday.start <= iso && iso <= holiday.end,
  );
  return matching.find((holiday) => !holiday.publicHoliday) ?? matching[0];
}

/** First day of the school year starting in `year`: the day after the summer holidays, or August 1st as fallback. */
function getSchoolYearStart(year: number, calendar: SchoolCalendar) {
  const summer = calendar.holidays.find(
    (holiday) => holiday.summer && holiday.end.startsWith(String(year)),
  );
  return summer ? addDays(parseISO(summer.end), 1) : new Date(year, 7, 1);
}

/** Holidays and second half starts (by start year), the base of all date logic. */
export type SchoolCalendar = {
  holidays: Holiday[];
  secondHalfStarts: Record<number, string>;
};

/** Default start of the second half of the school year starting in `year`. */
export const getDefaultSecondHalfStart = (year: number) => `${year + 1}-02-01`;

/** Builds the calendar from the holidays and the school years in use. */
export const createCalendar = (
  holidays: Holiday[],
  years: { year: number; secondHalfStart: string }[],
): SchoolCalendar => ({
  holidays,
  secondHalfStarts: Object.fromEntries(
    years.map(({ year, secondHalfStart }) => [year, secondHalfStart]),
  ),
});

/** First day of the second half of the school year starting in `year`. */
const getSecondHalfStart = (year: number, calendar: SchoolCalendar) =>
  parseISO(calendar.secondHalfStarts[year] ?? getDefaultSecondHalfStart(year));

/** Date range `[start, end)` of a school year part. */
export function getSchoolYearRange(
  year: number,
  part: SchoolYearPart,
  calendar: SchoolCalendar,
) {
  const half = getSecondHalfStart(year, calendar);
  return {
    start: part == "2" ? half : getSchoolYearStart(year, calendar),
    end: part == "1" ? half : getSchoolYearStart(year + 1, calendar),
  };
}

/** Start year of the school year that contains `date`. */
export function getSchoolYear(date: Date, calendar: SchoolCalendar) {
  const year = date.getFullYear();
  return date >= getSchoolYearStart(year, calendar) ? year : year - 1;
}

/** School year half that contains `date`. */
export function getSchoolYearPart(
  date: Date,
  calendar: SchoolCalendar,
): SchoolYearPart {
  const year = getSchoolYear(date, calendar);
  return date < getSecondHalfStart(year, calendar) ? "1" : "2";
}

/** Whether a class takes place in the school year part containing `date`. */
export function isSchoolClassActive(
  cls: SchoolClass,
  date: Date,
  calendar: SchoolCalendar,
) {
  const { start, end } = getSchoolYearRange(cls.year, cls.part, calendar);
  return start <= date && date < end;
}

/**
 * The weekly lessons of a class: the class itself and, if set, a copy carrying the day and
 * hour of its second lesson. Lets all schedule logic treat both lessons the same way.
 */
export function getClassOccurrences(cls: SchoolClass): SchoolClass[] {
  if (cls.day2 == null || cls.hour2 == null) return [cls];
  return [cls, { ...cls, day: cls.day2, hour: cls.hour2, double: cls.double2 }];
}

/** Whether two classes share a time slot during an overlapping period. */
export function doSchoolClassesCollide(
  a: SchoolClass,
  b: SchoolClass,
  calendar: SchoolCalendar,
) {
  const shareSlot = getClassOccurrences(a).some((first) =>
    getClassOccurrences(b).some((second) => {
      const firstEnd = first.hour + (first.double ? 1 : 0);
      const secondEnd = second.hour + (second.double ? 1 : 0);
      return (
        first.day == second.day &&
        first.hour <= secondEnd &&
        second.hour <= firstEnd
      );
    }),
  );
  if (!shareSlot) return false;
  const rangeA = getSchoolYearRange(a.year, a.part, calendar);
  const rangeB = getSchoolYearRange(b.year, b.part, calendar);
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}
