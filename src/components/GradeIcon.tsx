import { useSettings } from "../hooks/useSettings";
import { ABSENT_COLOR, getGradeColor } from "../lib/grades";
import { AbsentBadge, GradeBadge } from "./GradeBadge";

type GradeIconProps = {
  /** The grade; without one the "excused" symbol is shown. */
  grade?: number;
  size?: number;
};

/** Symbol of a grade or of "excused", as selected in the settings. */
export function GradeIcon({ grade, size = 32 }: GradeIconProps) {
  const { gradeSymbols, absentSymbol } = useSettings();
  if (grade == null) {
    return (
      <AbsentBadge symbol={absentSymbol} color={ABSENT_COLOR} size={size} />
    );
  }
  return (
    <GradeBadge
      symbol={gradeSymbols[grade]?.symbol ?? "value"}
      value={grade}
      color={getGradeColor(grade)}
      size={size}
    />
  );
}
