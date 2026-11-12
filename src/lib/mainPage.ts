/** The main pages, which the pages of a class lead back to. */
export type MainPage = "timetable" | "overview";

/** Display names of the main pages. */
export const MAIN_PAGE_LABELS: Record<MainPage, string> = {
  timetable: "Stundenplan",
  overview: "Übersichten",
};

const STORAGE_KEY = "mainPage";

/**
 * The main page shown last since the app started. Kept in memory only, so after a reload
 * (an update, or the app reopening its last page) the way back is unknown.
 */
let lastMainPage: MainPage | null = null;

/** The main page the pages of a class lead back to: the one shown last, else the timetable. */
export const getLastMainPage = (): MainPage => lastMainPage ?? "timetable";

/** Remembers the URL a main page was last shown with (e.g. the selected week). */
export function rememberMainPage(page: MainPage, url: string) {
  lastMainPage = page;
  try {
    sessionStorage.setItem(`${STORAGE_KEY}:${page}`, url);
  } catch {
    // Without storage the pages lead to the plain main page
  }
}

/** The main page with the URL it was last shown with, `null` if not shown in this session. */
export function getRememberedMainPage(
  page: MainPage,
): { page: MainPage; url: string } | null {
  try {
    const url = sessionStorage.getItem(`${STORAGE_KEY}:${page}`);
    return url ? { page, url } : null;
  } catch {
    return null;
  }
}
