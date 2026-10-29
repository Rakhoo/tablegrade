/** Key of a grade symbol as stored in `Grades.grade`. */
export type GradeKey = "1" | "2" | "3" | "4" | "5" | "E";

type GradeDefinition = {
  key: GradeKey;
  label: string;
  /** `false` for symbols that must not count as a grade (excused absence). */
  isGrade: boolean;
  color: string;
};

/** All selectable symbols, from best to worst, followed by "excused". */
export const GRADES: GradeDefinition[] = [
  { key: "1", label: "sehr gut", isGrade: true, color: "#15803d" },
  { key: "2", label: "gut", isGrade: true, color: "#65a30d" },
  { key: "3", label: "befriedigend", isGrade: true, color: "#64748b" },
  { key: "4", label: "ausreichend", isGrade: true, color: "#ea580c" },
  { key: "5", label: "mangelhaft", isGrade: true, color: "#dc2626" },
  { key: "E", label: "entschuldigt", isGrade: false, color: "#9ca3af" },
];

/** Looks up the definition of a stored grade key. */
export const getGradeDefinition = (key: string | null | undefined) =>
  GRADES.find((grade) => grade.key == key);
