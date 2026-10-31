import { getGradeDefinition, type GradeKey } from "../lib/grades";
import { GradeIcon } from "./GradeIcon";

type SuggestedGradeIconProps = { grade: GradeKey; size: number };

/** Faded symbol with a dashed ring: only a suggestion, not an entry. */
export function SuggestedGradeIcon({ grade, size }: SuggestedGradeIconProps) {
  const { color, label } = getGradeDefinition(grade)!;
  return (
    <span
      title={`Vorschlag: ${label}`}
      className="inline-flex rounded-full border border-dashed p-px"
      style={{ borderColor: color }}
    >
      <span className="flex opacity-40">
        <GradeIcon grade={grade} size={size - 4} />
      </span>
    </span>
  );
}
