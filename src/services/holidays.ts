import { getHolidays, insertHolidays, type Holiday } from "../db";

const API_URL = "https://www.mehr-schulferien.de/api/v2.1/cities/ahlen/periods";

type ApiPeriod = {
  id: number;
  starts_on: string;
  ends_on: string;
  name: string;
  is_public_holiday: boolean;
};

/**
 * Returns all cached holidays. If the cache does not reach the end of the year after next,
 * fresh data is fetched from the API first. Fetch errors (e.g. offline) are ignored.
 */
export async function loadHolidays(): Promise<Holiday[]> {
  const cached = await getHolidays();
  const year = new Date().getFullYear();
  if (cached.some((holiday) => holiday.end.startsWith(String(year + 2))))
    return cached;

  try {
    const response = await fetch(
      `${API_URL}?start_date=${year}-01-01&end_date=${year + 2}-12-31`,
    );
    const { data } = (await response.json()) as { data: ApiPeriod[] };
    await insertHolidays(
      data.map((period) => ({
        id: period.id,
        start: period.starts_on,
        end: period.ends_on,
        summer: period.name == "Sommer",
        publicHoliday: period.is_public_holiday,
      })),
    );
    return await getHolidays();
  } catch (error) {
    console.warn("Ferien konnten nicht geladen werden", error);
    return cached;
  }
}
