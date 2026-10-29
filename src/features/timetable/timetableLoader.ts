import { getCancelledDays, getSchoolClasses, waitForDatabase } from "../../db";
import { loadHolidays } from "../../services/holidays";

/** Loads holidays (refreshing them from the API if needed), cancelled days and all classes. */
export async function timetableLoader() {
  await waitForDatabase();
  const [holidays, cancelledDays, schoolClasses] = await Promise.all([
    loadHolidays(),
    getCancelledDays(),
    getSchoolClasses(),
  ]);
  return { holidays, cancelledDays, schoolClasses };
}

export type TimetableLoaderData = Awaited<ReturnType<typeof timetableLoader>>;
