import { WHOLE_GRADES, GRADE_VALUES, type GradePalette } from "./grades";
import type { AbsentSymbol, GradeSymbol } from "./gradeSymbols";
import type { ColorMode, ThemeId } from "./themes";

/** Federal states with their slug in the mehr-schulferien.de API. */
export const FEDERAL_STATES = [
  { slug: "baden-wuerttemberg", name: "Baden-Württemberg" },
  { slug: "bayern", name: "Bayern" },
  { slug: "berlin", name: "Berlin" },
  { slug: "brandenburg", name: "Brandenburg" },
  { slug: "bremen", name: "Bremen" },
  { slug: "hamburg", name: "Hamburg" },
  { slug: "hessen", name: "Hessen" },
  { slug: "mecklenburg-vorpommern", name: "Mecklenburg-Vorpommern" },
  { slug: "niedersachsen", name: "Niedersachsen" },
  { slug: "nordrhein-westfalen", name: "Nordrhein-Westfalen" },
  { slug: "rheinland-pfalz", name: "Rheinland-Pfalz" },
  { slug: "saarland", name: "Saarland" },
  { slug: "sachsen", name: "Sachsen" },
  { slug: "sachsen-anhalt", name: "Sachsen-Anhalt" },
  { slug: "schleswig-holstein", name: "Schleswig-Holstein" },
  { slug: "thueringen", name: "Thüringen" },
];

/** Level of offers spanning several levels. */
export const MIXED = "Mix";

/** Interaction mode of the seating plan. */
export type ClassroomMode = "warn" | "grade" | "comment" | "arrange";

type GradeSymbolSetting = { symbol: GradeSymbol; visible: boolean };

/** Symbols used by default, the ones with a tendency start hidden. */
const DEFAULT_SYMBOLS: Record<number, GradeSymbol> = {
  0.7: "plusPlus",
  1: "plusPlus",
  1.3: "plusPlus",
  1.7: "plus",
  2: "plus",
  2.3: "plus",
  2.7: "circlePlus",
  3: "ring",
  3.3: "ring",
  3.7: "circleMinus",
  4: "circleMinus",
  4.3: "circleMinus",
  4.7: "minus",
  5: "minus",
  5.3: "minus",
  6: "minusMinus",
};

/** All settings of the app; stored as JSON in the database, so backups include them. */
export const DEFAULT_SETTINGS = {
  federalState: "nordrhein-westfalen",
  theme: "lavender" as ThemeId,
  colorMode: "system" as ColorMode,
  gradeSymbols: Object.fromEntries(
    GRADE_VALUES.map((value) => [
      value,
      {
        symbol: DEFAULT_SYMBOLS[value],
        visible: WHOLE_GRADES.includes(value),
      },
    ]),
  ) as Record<number, GradeSymbolSetting>,
  absentSymbol: "slashed" as AbsentSymbol,
  /** Share of the exams in the final grade. */
  examShare: 0.5,
  /** Share of the projects in the part without exams, the rest is oral. */
  projectShare: 0.4,
  /** How many times the newest oral grade counts as much as the oldest. */
  recency: 1.5,
  /** Fewest assessments needed for a final grade, below that it is "n.b.". */
  minAssessments: 3,
  levels: ["5", "6", "7", "8", "9", "10", "EF", "Q1", "Q2", MIXED],
  /** Levels whose grades, marks and reports are shown as points (0–15) instead of marks. */
  pointLevels: ["EF", "Q1", "Q2"],
  letters: ["a", "b", "c", "d", "e", "f", "mix"],
  lessonsPerDay: 9,
  /** Color scale of the grades, also in the PDF export. */
  gradePalette: "standard" as GradePalette,
  /** Overview tables with lower rows and narrower columns. */
  compactTable: false,
  /** Whether the timetable shows the times of the lessons. */
  showLessonTimes: true,
  /** Start time ("08:00") of each lesson, by lesson number − 1; empty if not set. */
  lessonStarts: [
    "08:00",
    "08:50",
    "09:55",
    "10:45",
    "11:45",
    "12:35",
    "13:30",
    "14:20",
  ] as string[],
  /** Length of a lesson in minutes, for its end time. */
  lessonMinutes: 45,
  /** Timetable shows only the days and the range of lessons with classes that week. */
  compactTimetable: false,
  suggestions: true,
  startMode: "warn" as ClassroomMode,
  /** No longer written or read; kept as migration 23 lists it among the device settings. */
  lastBackup: null as string | null,
  pinHash: null as string | null,
  /** Seats for new students; `null` uses the built-in layout. */
  seatLayout: null as { x: number; y: number }[] | null,
  /** PDF export with grade and trait colors, otherwise black and white. */
  exportColors: true,
  /** Export numbers instead of symbols. */
  exportValues: false,
  /** Leaves the photos out of the PDF export, even if they are shown in the overview. */
  exportNoPhotos: false,
  /** Leaves the traits out of the PDF export, even if they are written out in the overview. */
  exportNoTraits: false,
  /** Which state and years the holidays in the database belong to. */
  holidayCache: null as {
    state: string;
    years: number[];
    /** Contains estimated summer holidays, which are replaced once the API has them. */
    provisional?: boolean;
    checkedOn?: string;
  } | null,
};

export type AppSettings = typeof DEFAULT_SETTINGS;

/**
 * Settings that belong to one device and are never synced: the holiday cache (the holidays
 * themselves stay local), backup and PIN state, and display choices that depend on the screen.
 * Migration 23 copies this list into its outbox triggers; a change needs a new migration.
 */
export const DEVICE_SETTING_KEYS: readonly (keyof AppSettings)[] = [
  "holidayCache",
  "lastBackup",
  "pinHash",
  "colorMode",
  "compactTable",
  "compactTimetable",
];

/** The grades offered while grading, from best to worst. */
export const getVisibleGrades = (settings: AppSettings) =>
  GRADE_VALUES.filter((value) => settings.gradeSymbols[value].visible);

/** Whether a class shows its grades as points, see `pointLevels`. */
export const usesPoints = (settings: AppSettings, cls: { number: string }) =>
  settings.pointLevels.includes(cls.number);

/** Levels without letters: those not starting with a number, like EF or Q1. */
export const hasLetters = (level: string) => /^\d/.test(level);
