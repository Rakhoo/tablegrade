/** Appends the given query parameters, leaving out empty ones. */
function withQuery(
  path: string,
  query: Record<string, string | number | null | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value != null && value !== "") params.set(key, String(value));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * URLs of all pages. A `date` (`YYYY-MM-DD`) selects the week of the timetable or the lesson
 * of a class.
 */
export const paths = {
  timetable: (date?: string | null) => withQuery("/timetable", { date }),
  /** All classes with their overview tables. */
  classes: () => "/classes",
  /** A new class, optionally preset with its school year half or its first lesson. */
  newClass: (
    preset: {
      date?: string | null;
      day?: number;
      hour?: number;
      year?: number;
      part?: string;
    } = {},
  ) => withQuery("/classes/new", preset),
  /** The seating plan of a lesson. */
  seating: (id: number, date?: string | null) =>
    withQuery(`/classes/${id}`, { date }),
  /** The overview table of a class, highlighting the lesson it was opened from. */
  table: (id: number, date?: string | null) =>
    withQuery(`/classes/${id}/table`, { date }),
  edit: (id: number, date?: string | null) =>
    withQuery(`/classes/${id}/edit`, { date }),
  names: (id: number, date?: string | null) =>
    withQuery(`/classes/${id}/names`, { date }),
  settings: () => "/settings",
  notFound: () => "/404",
};
