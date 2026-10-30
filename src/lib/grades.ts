/** Key of a grade symbol as stored in `Grades.grade`. */
export type GradeKey = "1" | "2" | "3+" | "3" | "3-" | "4" | "5" | "E";

/** What a tap on a student does while grading: set a symbol, remove it, or edit the comment. */
export type GradeTool = GradeKey | "erase" | "comment";

/** Symbol for students who were excused; it does not count as a grade. */
export const ABSENT_GRADE: GradeKey = "E";

/** Initially selected grading tool: the neutral symbol, the most frequently used one. */
export const DEFAULT_GRADE_TOOL: GradeKey = "3";

type GradeDefinition = {
  key: GradeKey;
  label: string;
  /** `false` for symbols that must not count as a grade (excused absence). */
  isGrade: boolean;
  color: string;
};

/**
 * All selectable symbols, from best to worst, followed by "excused". The keys are stored in
 * the database and must stay stable: "4" stands for about 4.5, "5" for about a 6.
 */
export const GRADES: GradeDefinition[] = [
  { key: "1", label: "sehr gut", isGrade: true, color: "#15803d" },
  { key: "2", label: "gut", isGrade: true, color: "#65a30d" },
  { key: "3+", label: "befriedigend+", isGrade: true, color: "#0d9488" },
  { key: "3", label: "befriedigend", isGrade: true, color: "#64748b" },
  { key: "3-", label: "befriedigend−", isGrade: true, color: "#ca8a04" },
  { key: "4", label: "ausreichend−", isGrade: true, color: "#ea580c" },
  { key: "5", label: "ungenügend", isGrade: true, color: "#dc2626" },
  { key: "E", label: "entschuldigt", isGrade: false, color: "#9ca3af" },
];

/** Looks up the definition of a stored grade key. */
export const getGradeDefinition = (key: string | null | undefined) =>
  GRADES.find((grade) => grade.key == key);
