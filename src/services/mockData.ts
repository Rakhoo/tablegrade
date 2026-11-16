import {
  getHolidays,
  getSchoolYears,
  replaceWithMockData,
  saveSchoolYear,
} from "../db";
import { createMockData } from "../lib/mockData";
import {
  createCalendar,
  getDefaultSecondHalfStart,
  getSchoolYear,
  getSchoolYearPart,
} from "../lib/schoolYear";

/**
 * Deletes all classes, students and their data and fills the app with mock data of the
 * current school year half, which is added to the school years if missing. For trying the app out
 * and for demonstrations; settings, holidays and school years stay.
 */
export async function fillWithMockData() {
  const [holidays, schoolYears] = await Promise.all([
    getHolidays(),
    getSchoolYears(),
  ]);
  let calendar = createCalendar(holidays, schoolYears);
  const year = getSchoolYear(new Date(), calendar);
  if (!schoolYears.some((schoolYear) => schoolYear.year == year)) {
    await saveSchoolYear(year, getDefaultSecondHalfStart(year));
    calendar = createCalendar(holidays, await getSchoolYears());
  }
  await replaceWithMockData(
    createMockData(year, getSchoolYearPart(new Date(), calendar), calendar),
  );
}
