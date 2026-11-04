const STORAGE_KEY = "return";

/** Names of the pages a page with a real way back can be opened from, by their path. */
const PAGE_NAMES: [RegExp, string][] = [
  [/^\/timetable/, "Stundenplan"],
  [/^\/(classes|overview)\/\d+\/edit/, "Bearbeiten"],
  [/^\/classes\/new/, "Neue Klasse"],
  [/\/names/, "Namen lernen"],
  [/^\/settings/, "Einstellungen"],
  [/^\/overview\/\d+/, "Übersicht"],
  [/^\/overview/, "Übersichten"],
  [/^\/classes\/\d+/, "Sitzplan"],
];

/** Storage key per target page, without its query, so each target keeps its own way back. */
const keyOf = (url: string) => `${STORAGE_KEY}:${url.split("?")[0]}`;

/** Remembers the page `to` is opened from, so it can name its way back. */
export function rememberReturnPage(to: string, from: string) {
  try {
    sessionStorage.setItem(keyOf(to), from);
  } catch {
    // The page then leads back to its fallback
  }
}

/** Remembers the current page as the one `to` is opened from, for links outside the speed dial. */
export const rememberCurrentPageFor = (to: string) =>
  // The router keeps its location in the hash
  rememberReturnPage(to, window.location.hash.slice(1) || "/");

/**
 * The page the page at `pathname` was opened from, with its name; `fallback` if unknown.
 */
export function getReturnPage(pathname: string, fallback: string) {
  let url = fallback;
  try {
    url = sessionStorage.getItem(keyOf(pathname)) ?? fallback;
  } catch {
    // The fallback is the way back then
  }
  const name =
    PAGE_NAMES.find(([pattern]) => pattern.test(url))?.[1] ?? "Zurück";
  return { url, name };
}
