import { useStoredBoolean } from "./useStoredBoolean";

/** Display options of the class pages with their defaults; one setting for all pages. */
const DISPLAY_OPTIONS = {
  /** Student photos on the seats and before the names. */
  photos: true,
  /** Traits: dots on the seats, written out below the names in the overview. */
  traits: true,
  /** Duties: colored symbols on the seats (seating plan only). */
  duties: true,
  /** Nicknames instead of full names in the overview. */
  nicknames: false,
  /** Overview rows sorted by last name, whether it is shown or not. */
  lastNameSort: false,
  /** Seating plan zoomed in on the seated students. */
  zoom: true,
  /** Grading with one tool button on large screens too; small screens always use it. */
  gradeButton: false,
  /** A tap on a name in the overview opens the student card; otherwise it only covers the others. */
  studentCard: true,
};

export type DisplayOption = keyof typeof DISPLAY_OPTIONS;

/** Storage keys, kept from before the options were shared, so the choices stay. */
const STORAGE_KEYS: Record<DisplayOption, string> = {
  photos: "showPhotos",
  traits: "showTraits",
  duties: "showDuties",
  nicknames: "overviewNicknames",
  lastNameSort: "overviewLastNameSort",
  zoom: "seatZoom",
  gradeButton: "gradeButton",
  studentCard: "studentCard",
};

/** A display option of the class pages, kept on the device. */
export const useDisplayOption = (option: DisplayOption) =>
  useStoredBoolean(STORAGE_KEYS[option], DISPLAY_OPTIONS[option]);
