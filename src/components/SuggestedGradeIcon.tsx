import { formatMark, getGradeColor } from "../lib/grades";
import { GradeIcon } from "./GradeIcon";

type SuggestedGradeIconProps = { grade: number; size: number };

/** Faded symbol with a dashed ring: only a suggestion, not an entry. */
export function SuggestedGradeIcon({ grade, size }: SuggestedGradeIconProps) {
  return (
    <span
      title={`Vorschlag: ${formatMark(grade)}`}
      className="inline-flex rounded-full border border-dashed p-px"
      style={{ borderColor: getGradeColor(grade) }}
    >
      <span className="flex opacity-40">
        <GradeIcon grade={grade} size={size - 4} />
      </span>
    </span>
  );
}
