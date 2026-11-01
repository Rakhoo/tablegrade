import { formatMark, getGradeColor } from "../lib/grades";

type MarkBadgeProps = { mark: number; className?: string };

/** Small colored badge with a classic mark like "2+". */
export function MarkBadge({ mark, className = "" }: MarkBadgeProps) {
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold text-white ${className}`}
      style={{
        background: getGradeColor(mark),
        borderColor: "var(--color-surface)",
      }}
    >
      {formatMark(mark).replace("-", "−")}
    </span>
  );
}
