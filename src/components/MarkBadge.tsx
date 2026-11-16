import { useGradeColor, useGradeFormat } from "../hooks/useGradeFormat";

type MarkBadgeProps = {
  mark: number;
  /** Diameter in pixels; the text scales along. */
  size?: number;
  className?: string;
};

/**
 * Small round badge with a mark like "2+", or its points in classes using points. Always a
 * circle, also with a tendency: two characters at half the diameter fit without padding.
 */
export function MarkBadge({ mark, size = 24, className = "" }: MarkBadgeProps) {
  const formatGrade = useGradeFormat();
  const getGradeColor = useGradeColor();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tighter whitespace-nowrap text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size / 2,
        background: getGradeColor(mark),
        borderColor: "var(--color-surface)",
      }}
    >
      {formatGrade(mark).replace("-", "−")}
    </span>
  );
}
