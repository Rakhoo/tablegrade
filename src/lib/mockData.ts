import type { SchoolClass, SchoolYearPart } from "../db";
import { toIsoDate } from "./dates";
import { SUGGESTED_DUTIES } from "./duties";
import {
  getNearestGrade,
  GRADE_VALUES,
  WHOLE_GRADES,
  type LessonType,
} from "./grades";
import { getLessonDates } from "./lessons";
import type { Report } from "./reports";
import { FIRST_NAMES, LAST_NAMES } from "./mockNames";
import type { SchoolCalendar } from "./schoolYear";

/** A made up student of a mock class. */
export type MockStudent = {
  firstName: string;
  lastName: string;
  /** Avatar as SVG data URL. */
  image: string;
  traitNames: string[];
  dutyName: string | null;
};

/** A made up entry; `student` is the index in the class's students. */
export type MockEntry = {
  student: number;
  date: string;
  grade: number | null;
  mark: number | null;
  projectMark: number | null;
  absent: boolean;
  warnings: number;
  comment: string | null;
};

/** A mock class with everything that belongs to it. */
export type MockClass = {
  cls: Omit<SchoolClass, "id">;
  students: MockStudent[];
  entries: MockEntry[];
  lessonTypes: { date: string; type: LessonType }[];
  reports: Report[];
};

/** All mock data: traits and duties first, as the classes refer to them by name. */
export type MockData = {
  traits: { name: string; color: string }[];
  duties: { name: string; symbol: string; color: string }[];
  classes: MockClass[];
};

/** Small seeded random generator (mulberry32), so the mock data is the same every time. */
function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (probability: number) => next() < probability,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    between: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
  };
}

type Random = ReturnType<typeof createRandom>;

const SKIN_TONES = [
  "#f9d7c0",
  "#f1c27d",
  "#e0ac69",
  "#c68642",
  "#a0662f",
  "#8d5524",
  "#5c3a1e",
];
const HAIR_COLORS = [
  "#1f1a17",
  "#3b2a20",
  "#6a4e35",
  "#a5713d",
  "#d9b26f",
  "#8c2f1b",
];
const SHIRT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#64748b",
  "#84cc16",
  "#f43f5e",
];
const BACKGROUNDS = [
  "#e0e7ff",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#e0f2fe",
  "#ede9fe",
  "#f1f5f9",
];

/**
 * A user symbol as photo: head and shoulders with a random skin tone, hair and shirt color.
 * Width and height are set, so browsers know its size when drawing it (PDF export).
 */
function createAvatar(random: Random) {
  const skin = random.pick(SKIN_TONES);
  const hair = random.pick(HAIR_COLORS);
  const style = random.between(0, 3);
  const hairShape = [
    // Short
    `<path d="M33 40a17 17 0 0 1 34 0c-4-6-10-9-17-9s-13 3-17 9z" fill="${hair}"/>`,
    // Long
    `<path d="M31 42a19 19 0 0 1 38 0v22h-7V44c-3-7-8-10-12-10s-9 3-12 10v20h-7z" fill="${hair}"/>`,
    // Curly
    `<g fill="${hair}"><circle cx="38" cy="30" r="8"/><circle cx="50" cy="26" r="9"/><circle cx="62" cy="30" r="8"/><circle cx="34" cy="38" r="6"/><circle cx="66" cy="38" r="6"/></g>`,
    // Very short
    `<path d="M34 38a16 15 0 0 1 32 0c-5-3-10-4-16-4s-11 1-16 4z" fill="${hair}"/>`,
  ][style];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${random.pick(BACKGROUNDS)}"/>` +
    `<path d="M18 100c0-20 14-31 32-31s32 11 32 31z" fill="${random.pick(SHIRT_COLORS)}"/>` +
    `<rect x="44" y="56" width="12" height="14" rx="5" fill="${skin}"/>` +
    `<ellipse cx="50" cy="43" rx="16" ry="18" fill="${skin}"/>` +
    hairShape +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** One weekly lesson: weekday (1 = Monday), first lesson and whether it is a double lesson. */
type Slot = [day: number, hour: number, double: boolean];

/**
 * The mock timetable: two subjects in several classes, nearly every lesson of the week filled,
 * each class at most twice a week on different days.
 */
const TIMETABLE: {
  subject: string;
  number: string;
  letter: string | null;
  slots: Slot[];
}[] = [
  {
    subject: "Mathematik",
    number: "5",
    letter: "a",
    slots: [
      [1, 1, true],
      [4, 3, false],
    ],
  },
  {
    subject: "Mathematik",
    number: "6",
    letter: "b",
    slots: [
      [1, 3, false],
      [3, 1, true],
    ],
  },
  {
    subject: "Mathematik",
    number: "7",
    letter: "c",
    slots: [
      [2, 1, true],
      [5, 5, false],
    ],
  },
  {
    subject: "Mathematik",
    number: "8",
    letter: "a",
    slots: [
      [1, 5, false],
      [4, 1, true],
    ],
  },
  {
    subject: "Mathematik",
    number: "9",
    letter: "b",
    slots: [
      [2, 5, true],
      [5, 1, false],
    ],
  },
  {
    subject: "Mathematik",
    number: "10",
    letter: "a",
    slots: [
      [3, 3, false],
      [5, 3, true],
    ],
  },
  {
    subject: "Mathematik",
    number: "Q1",
    letter: null,
    slots: [
      [1, 7, true],
      [4, 5, false],
    ],
  },
  {
    subject: "Biologie",
    number: "5",
    letter: "b",
    slots: [
      [2, 3, false],
      [5, 2, false],
    ],
  },
  {
    subject: "Biologie",
    number: "6",
    letter: "a",
    slots: [
      [3, 5, false],
      [4, 6, false],
    ],
  },
  {
    subject: "Biologie",
    number: "7",
    letter: "a",
    slots: [
      [2, 4, false],
      [3, 6, false],
    ],
  },
  {
    subject: "Biologie",
    number: "8",
    letter: "c",
    slots: [
      [1, 6, false],
      [4, 7, false],
    ],
  },
  {
    subject: "Biologie",
    number: "EF",
    letter: null,
    slots: [
      [3, 7, true],
      [5, 6, false],
    ],
  },
  { subject: "Biologie", number: "Q2", letter: null, slots: [[2, 7, true]] },
];

const TRAITS = [
  { name: "Brille", color: "#4f46e5" },
  { name: "LRS", color: "#14b8a6" },
  { name: "Förderbedarf", color: "#ec4899" },
  { name: "Sitzt vorne", color: "#84cc16" },
];

const COMMENTS = [
  "Hausaufgaben vergessen",
  "Sehr gute Mitarbeit heute",
  "Material fehlt",
  "Hat ein Referat angeboten",
  "Zu spät gekommen",
  "Hilft anderen gern",
  "Unruhig, mehrfach angesprochen",
];

/** Made up students with different last names within the class, some sharing a first name. */
function createStudents(random: Random, count: number): MockStudent[] {
  const lastNames = [...LAST_NAMES];
  const students: MockStudent[] = [];
  while (students.length < count) {
    const [lastName] = lastNames.splice(
      Math.floor(random.next() * lastNames.length),
      1,
    );
    students.push({
      firstName: random.pick(FIRST_NAMES),
      lastName,
      image: createAvatar(random),
      traitNames: TRAITS.filter(() => random.chance(0.12)).map(
        ({ name }) => name,
      ),
      dutyName: null,
    });
  }
  // A handful of duties per class, each once
  for (const duty of SUGGESTED_DUTIES.slice(0, random.between(3, 6))) {
    const free = students.filter((student) => !student.dutyName);
    random.pick(free).dutyName = duty.name;
  }
  return students;
}

/** A random grade around a student's level: oral grades whole, marks with tendencies. */
const gradeAround = (random: Random, level: number, grades: number[]) =>
  getNearestGrade(
    Math.min(6, Math.max(0.7, level + (random.next() - 0.5) * 1.6)),
    grades,
  );

/**
 * Lessons so far with entries: oral grades for nearly everyone, now and then absences,
 * warnings and comments; roughly every eighth lesson an exam (absent students write a retake
 * a few lessons later), one project, and in longer halves a partial grade.
 */
function createLessons(
  random: Random,
  students: MockStudent[],
  dates: string[],
): Pick<MockClass, "entries" | "lessonTypes" | "reports"> {
  const levels = students.map(() =>
    Math.min(5, Math.max(1, 2.8 + (random.next() - 0.5) * 2.6)),
  );
  const entries: MockEntry[] = [];
  const lessonTypes: MockClass["lessonTypes"] = [];
  const retakes = new Map<string, number[]>();
  const projectIndex = dates.length > 12 ? 11 : -1;

  dates.forEach((date, index) => {
    const isExam = index % 8 == 6;
    const isProject = index == projectIndex && !isExam;
    const retakers = retakes.get(date) ?? [];
    if (isExam) lessonTypes.push({ date, type: "exam" });
    if (isProject) lessonTypes.push({ date, type: "project" });
    if (retakers.length > 0) lessonTypes.push({ date, type: "retake" });
    const missed: number[] = [];

    students.forEach((_, student) => {
      const entry: MockEntry = {
        student,
        date,
        grade: null,
        mark: null,
        projectMark: null,
        absent: false,
        warnings: 0,
        comment: null,
      };
      if (retakers.includes(student)) {
        entry.mark = gradeAround(random, levels[student], GRADE_VALUES);
      } else if (random.chance(0.05)) {
        entry.absent = true;
        if (isExam) missed.push(student);
      } else if (isExam) {
        entry.mark = gradeAround(random, levels[student], GRADE_VALUES);
      } else {
        entry.grade = gradeAround(random, levels[student], WHOLE_GRADES);
        if (isProject)
          entry.projectMark = gradeAround(
            random,
            levels[student],
            GRADE_VALUES,
          );
        if (random.chance(0.04)) entry.warnings = random.chance(0.2) ? 2 : 1;
        if (random.chance(0.025)) entry.comment = random.pick(COMMENTS);
      }
      entries.push(entry);
    });

    // The retake is a few lessons later, if that lesson took place already
    const retakeDate = dates[index + 3];
    if (missed.length > 0 && retakeDate) retakes.set(retakeDate, missed);
  });

  const reports: Report[] =
    dates.length > 22
      ? [{ date: dates[Math.floor(dates.length * 0.6)], kind: "partial" }]
      : [];
  return { entries, lessonTypes, reports };
}

/**
 * Builds the mock data for a school year half: the classes of `TIMETABLE` with made up
 * students and their entries in all lessons before `today`.
 */
export function createMockData(
  year: number,
  part: SchoolYearPart,
  calendar: SchoolCalendar,
  today = new Date(),
): MockData {
  const random = createRandom(20261115);
  const todayIso = toIsoDate(today);
  const classes = TIMETABLE.map(({ subject, number, letter, slots }) => {
    const [first, second] = slots;
    const cls: Omit<SchoolClass, "id"> = {
      subject,
      number,
      letter,
      year,
      part,
      day: first[0],
      hour: first[1],
      double: first[2],
      day2: second?.[0] ?? null,
      hour2: second?.[1] ?? null,
      double2: second?.[2] ?? false,
    };
    const upper = !/^\d/.test(number);
    const students = createStudents(
      random,
      upper ? random.between(14, 22) : random.between(22, 28),
    );
    const dates = getLessonDates(
      { ...cls, id: "" },
      calendar,
      { days: [], lessons: [] },
      today,
    ).filter((date) => date < todayIso);
    return { cls, students, ...createLessons(random, students, dates) };
  });
  return {
    traits: TRAITS,
    duties: SUGGESTED_DUTIES,
    classes,
  };
}
