import { useGradeColor, useGradeFormat } from "../hooks/useGradeFormat";
import { GradeIcon } from "./GradeIcon";

type SuggestedGradeIconProps = { grade: number; size: number };

/** Faded symbol with a dashed ring: only a suggestion, not an entry. */
export function SuggestedGradeIcon({ grade, size }: SuggestedGradeIconProps) {
  const formatGrade = useGradeFormat();
  const getGradeColor = useGradeColor();
  return (
    <span
      title={`Vorschlag: ${formatGrade(grade)}`}
      className="inline-flex rounded-full border border-dashed p-px"
      style={{ borderColor: getGradeColor(grade) }}
    >
      <span className="flex opacity-40">
        <GradeIcon grade={grade} size={size - 4} />
      </span>
    </span>
  );
}
