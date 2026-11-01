import {
  getHolidays,
  replaceHolidays,
  saveSettings,
  type Holiday,
} from "../db";
import { toIsoDate } from "../lib/dates";
import {
  addProvisionalSummers,
  getBaseLastSchoolYear,
  hasProvisionalSummers,
} from "../lib/schoolYear";
import type { AppSettings } from "../lib/settings";

/** How far beyond the assumed last school year the API is searched. */
const MAX_YEARS_AHEAD = 5;

const API_URL = "https://www.mehr-schulferien.de/api/v2.1/federal-states";

type ApiPeriod = {
  id: number;
  starts_on: string;
  ends_on: string;
  name: string;
  is_public_holiday: boolean;
};

/** Summer holidays 2019 per state, which the API misses, but which start school year 2019/20. */
const SUMMER_HOLIDAYS_2019: Record<string, [start: string, end: string]> = {
  "baden-wuerttemberg": ["2019-07-29", "2019-09-10"],
  bayern: ["2019-07-29", "2019-09-09"],
  berlin: ["2019-06-20", "2019-08-02"],
  brandenburg: ["2019-06-20", "2019-08-03"],
  bremen: ["2019-07-04", "2019-08-14"],
  hamburg: ["2019-06-27", "2019-08-07"],
  hessen: ["2019-07-01", "2019-08-09"],
  "mecklenburg-vorpommern": ["2019-07-01", "2019-08-10"],
  niedersachsen: ["2019-07-04", "2019-08-14"],
  "nordrhein-westfalen": ["2019-07-15", "2019-08-27"],
  "rheinland-pfalz": ["2019-07-01", "2019-08-09"],
  saarland: ["2019-07-01", "2019-08-09"],
  sachsen: ["2019-07-08", "2019-08-16"],
  "sachsen-anhalt": ["2019-07-04", "2019-08-14"],
  "schleswig-holstein": ["2019-07-01", "2019-08-10"],
  thueringen: ["2019-07-08", "2019-08-17"],
};

/**
 * Fetches the holidays of a federal state for school years: all of a school year and both
 * summer holidays around it, which define its start and end.
 */
export async function fetchHolidays(state: string, years: number[]) {
  const periods = await Promise.all(
    years.map(async (year) => {
      const response = await fetch(
        `${API_URL}/${state}/periods?start_date=${year}-06-01&end_date=${year + 1}-09-30`,
      );
      const { data } = (await response.json()) as { data: ApiPeriod[] };
      return data;
    }),
  );
  const byId = new Map<number, Holiday>();
  for (const period of periods.flat()) {
    byId.set(period.id, {
      id: period.id,
      start: period.starts_on,
      end: period.ends_on,
      summer: period.name == "Sommer",
      publicHoliday: period.is_public_holiday,
    });
  }
  if (years.includes(2019)) {
    const [start, end] = SUMMER_HOLIDAYS_2019[state];
    // Negative, as the ids of the API are positive
    byId.set(-1, { id: -1, start, end, summer: true, publicHoliday: false });
  }
  return addProvisionalSummers([...byId.values()], years);
}

/**
 * Finds the latest school year the API knows, which is the one with its starting summer
 * holidays: at least the assumed one, as the school year may start with an estimate.
 */
export async function fetchLastSchoolYear(state: string) {
  let last = getBaseLastSchoolYear();
  for (let year = last + 1; year <= last + MAX_YEARS_AHEAD; year++) {
    const response = await fetch(
      `${API_URL}/${state}/periods?start_date=${year}-06-01&end_date=${year}-09-30`,
    );
    const { data } = (await response.json()) as { data: ApiPeriod[] };
    if (!data.some((period) => period.name == "Sommer")) break;
    last = year;
  }
  return last;
}

/**
 * Whether the cached holidays fit the selected state and school years. Estimated summer
 * holidays are checked against the API once a day, to replace them as soon as possible.
 */
const isCacheValid = (settings: AppSettings, years: number[]) => {
  const cache = settings.holidayCache;
  return (
    cache?.state == settings.federalState &&
    cache.years.join() == years.join() &&
    (!cache.provisional || cache.checkedOn == toIsoDate(new Date()))
  );
};

/** Replaces the cached holidays and remembers what they belong to. */
export async function storeHolidays(
  entries: Holiday[],
  state: string,
  years: number[],
) {
  await replaceHolidays(entries);
  await saveSettings({
    holidayCache: {
      state,
      years,
      provisional: hasProvisionalSummers(entries),
      checkedOn: toIsoDate(new Date()),
    },
  });
}

/**
 * Returns the holidays of the school years in use, fetching them if the cache belongs to
 * another selection. Fetch errors (e.g. offline) are ignored.
 */
export async function loadHolidays(
  settings: AppSettings,
  years: number[],
): Promise<Holiday[]> {
  if (isCacheValid(settings, years)) return getHolidays();
  try {
    const entries = await fetchHolidays(settings.federalState, years);
    await storeHolidays(entries, settings.federalState, years);
    return entries;
  } catch (error) {
    console.warn("Ferien konnten nicht geladen werden", error);
    return getHolidays();
  }
}
