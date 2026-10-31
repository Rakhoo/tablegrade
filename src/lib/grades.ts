/** Key of a grade symbol as stored in `Grades.grade`. */
export type GradeKey = "1" | "2" | "3+" | "3" | "3-" | "4" | "5" | "E";

/** Classic mark, e.g. "2+", stored in `Grades.mark`. */
export type Mark = (typeof MARKS)[number];

/** Kind of a lesson: a regular one, an exam ("Klausur") or one with a project. */
export type LessonType = "normal" | "exam" | "project";

/** Marks from best to worst; there is no "1+" and no tendency for a 6. */
export const MARKS = [
  "1",
  "1-",
  "2+",
  "2",
  "2-",
  "3+",
  "3",
  "3-",
  "4+",
  "4",
  "4-",
  "5+",
  "5",
  "5-",
  "6",
] as const;

/**
 * What a tap on a student does while grading: set a symbol or a mark, remove one of them,
 * enter the suggested symbol or edit the comment. Marks are prefixed, as their values overlap
 * with the symbol keys.
 */
export type GradeTool =
  GradeKey | `mark:${Mark}` | "erase" | "eraseMark" | "suggestion" | "comment";

/** Symbol for students who were excused; it does not count as a grade. */
export const ABSENT_GRADE: GradeKey = "E";

/** Initially selected grading tool: the neutral symbol, the most frequently used one. */
export const DEFAULT_GRADE_TOOL: GradeKey = "3";

type GradeDefinition = {
  key: GradeKey;
  label: string;
  /** `false` for symbols that must not count as a grade (excused absence). */
  isGrade: boolean;
  /** Grade the symbol stands for in calculations; `null` if it does not count. */
  value: number | null;
  color: string;
};

/**
 * All selectable symbols, from best to worst, followed by "excused". The keys are stored in
 * the database and must stay stable: "4" stands for about 4.5, "5" for about a 6.
 */
export const GRADES: GradeDefinition[] = [
  { key: "1", label: "sehr gut", isGrade: true, value: 1, color: "#15803d" },
  { key: "2", label: "gut", isGrade: true, value: 2, color: "#65a30d" },
  {
    key: "3+",
    label: "befriedigend+",
    isGrade: true,
    value: 2.7,
    color: "#0d9488",
  },
  {
    key: "3",
    label: "befriedigend",
    isGrade: true,
    value: 3,
    color: "#64748b",
  },
  {
    key: "3-",
    label: "befriedigend−",
    isGrade: true,
    value: 3.3,
    color: "#ca8a04",
  },
  {
    key: "4",
    label: "ausreichend−",
    isGrade: true,
    value: 4.5,
    color: "#ea580c",
  },
  { key: "5", label: "ungenügend", isGrade: true, value: 6, color: "#dc2626" },
  {
    key: "E",
    label: "entschuldigt",
    isGrade: false,
    value: null,
    color: "#9ca3af",
  },
];

/** Looks up the definition of a stored grade key. */
export const getGradeDefinition = (key: string | null | undefined) =>
  GRADES.find((grade) => grade.key == key);

const MARK_COLORS = [
  "#15803d",
  "#65a30d",
  "#64748b",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
];

/** Color of a mark, by its whole number. */
export const getMarkColor = (mark: string) => MARK_COLORS[Number(mark[0]) - 1];

/** Grade a mark stands for in calculations: a tendency is worth 0.3, e.g. "2+" is 1.7. */
export function getMarkValue(mark: string) {
  const tendency = { "+": -0.3, "-": 0.3 }[mark[1]] ?? 0;
  return Number(mark[0]) + tendency;
}

/** Whether a lesson counts as complete for a student: exams need a mark or "excused". */
export const isEntryComplete = (
  entry: { grade: string | null; mark: string | null } | undefined,
  type: LessonType,
) => !!(entry?.grade || (type == "exam" && entry?.mark));

/** Symbol entries an exam replaces: all but "excused". */
export const isReplacedByExam = (grade: string | null) =>
  !!grade && grade != ABSENT_GRADE;

/** The tools available for a lesson type; without a type all of them (overview table). */
export function getGradeTools(type?: LessonType) {
  const symbols: GradeKey[] =
    type == "exam" ? [ABSENT_GRADE] : GRADES.map((grade) => grade.key);
  const marks: GradeTool[] =
    type == "normal"
      ? []
      : [
          ...MARKS.map((mark) => `mark:${mark}` as const),
          ...(type == "exam" ? [] : (["eraseMark"] as const)),
        ];
  return { symbols, marks };
}

/** Keeps a tool if it fits the lesson type, otherwise returns the type's neutral default. */
export function getValidGradeTool(
  tool: GradeTool,
  type: LessonType,
): GradeTool {
  const { symbols, marks } = getGradeTools(type);
  const others: GradeTool[] =
    type == "exam" ? ["erase", "comment"] : ["suggestion", "erase", "comment"];
  if ([...symbols, ...marks, ...others].includes(tool)) return tool;
  return type == "exam" ? "mark:3" : DEFAULT_GRADE_TOOL;
}
