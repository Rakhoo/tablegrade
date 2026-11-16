import { useGradeColor, useGradeFormat } from "../hooks/useGradeFormat";

type MarkBadgeProps = { mark: number; className?: string };

/** Small colored badge with a mark like "2+", or its points in classes using points. */
export function MarkBadge({ mark, className = "" }: MarkBadgeProps) {
  const formatGrade = useGradeFormat();
  const getGradeColor = useGradeColor();
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold text-white ${className}`}
      style={{
        background: getGradeColor(mark),
        borderColor: "var(--color-surface)",
      }}
    >
      {formatGrade(mark).replace("-", "−")}
    </span>
  );
}
