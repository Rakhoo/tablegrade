import { addDays, parseISO } from "date-fns";
import type { Holiday, SchoolClass, SchoolYearPart } from "../db";
import { toIsoDate } from "./dates";

/** Number of lessons per school day shown in the timetable. */
export const LESSONS_PER_DAY = 9;

/** Weekday names, index 0 = Monday. */
export const WEEKDAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

/** Selectable grade levels; the upper school levels have no class letter. */
export const CLASS_LEVELS = ["5", "6", "7", "8", "9", "10", "EF", "Q1", "Q2"];
export const UPPER_SCHOOL_LEVELS = ["EF", "Q1", "Q2"];

/** Selectable class letters for levels 5–10. */
export const CLASS_LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Earliest selectable school year (start year). */
export const FIRST_SCHOOL_YEAR = 2026;

export const SCHOOL_YEAR_PART_LABELS: Record<SchoolYearPart, string> = {
  "1": "1. Halbjahr",
  "2": "2. Halbjahr",
  full: "Ganzes Jahr",
};

/** Whether `date` lies inside any holiday period. */
export function isHoliday(date: Date, holidayList: Holiday[]) {
  return !!getHoliday(date, holidayList);
}

/** The holiday period containing `date`; vacations take precedence over public holidays. */
export function getHoliday(date: Date, holidayList: Holiday[]) {
  const iso = toIsoDate(date);
  const matching = holidayList.filter(
    (holiday) => holiday.start <= iso && iso <= holiday.end,
  );
  return matching.find((holiday) => !holiday.publicHoliday) ?? matching[0];
}

/** First day of the school year starting in `year`: the day after the summer holidays, or August 1st as fallback. */
function getSchoolYearStart(year: number, holidayList: Holiday[]) {
  const summer = holidayList.find(
    (holiday) => holiday.summer && holiday.end.startsWith(String(year)),
  );
  return summer ? addDays(parseISO(summer.end), 1) : new Date(year, 7, 1);
}

/**
 * First day of the second half per school year (start year), from the NRW "Ferienordnung"
 * (https://bass.schule.nrw/191.htm). There is no API for these dates, extend the table yearly.
 */
const SECOND_HALF_STARTS: Record<number, string> = {
  2026: "2027-02-15",
  2027: "2028-02-07",
  2028: "2029-01-29",
  2029: "2030-01-28",
};

/** First day of the second half of the school year starting in `year`; February 1st if unknown. */
export function getSecondHalfStart(year: number) {
  const known = SECOND_HALF_STARTS[year];
  return known ? parseISO(known) : new Date(year + 1, 1, 1);
}

/** Date range `[start, end)` of a school year part. */
export function getSchoolYearRange(
  year: number,
  part: SchoolYearPart,
  holidayList: Holiday[],
) {
  const half = getSecondHalfStart(year);
  return {
    start: part == "2" ? half : getSchoolYearStart(year, holidayList),
    end: part == "1" ? half : getSchoolYearStart(year + 1, holidayList),
  };
}

/** Start year of the school year that contains `date`. */
export function getSchoolYear(date: Date, holidayList: Holiday[]) {
  const year = date.getFullYear();
  return date >= getSchoolYearStart(year, holidayList) ? year : year - 1;
}

/** School year half that contains `date`. */
export function getSchoolYearPart(
  date: Date,
  holidayList: Holiday[],
): SchoolYearPart {
  const year = getSchoolYear(date, holidayList);
  return date < getSecondHalfStart(year) ? "1" : "2";
}

/** Whether a class takes place in the school year part containing `date`. */
export function isSchoolClassActive(
  cls: SchoolClass,
  date: Date,
  holidayList: Holiday[],
) {
  const { start, end } = getSchoolYearRange(cls.year, cls.part, holidayList);
  return start <= date && date < end;
}

/** Whether two classes share a time slot during an overlapping period. */
export function doSchoolClassesCollide(
  a: SchoolClass,
  b: SchoolClass,
  holidayList: Holiday[],
) {
  if (a.day != b.day) return false;
  const aEnd = a.hour + (a.double ? 1 : 0);
  const bEnd = b.hour + (b.double ? 1 : 0);
  if (a.hour > bEnd || b.hour > aEnd) return false;
  const rangeA = getSchoolYearRange(a.year, a.part, holidayList);
  const rangeB = getSchoolYearRange(b.year, b.part, holidayList);
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}
