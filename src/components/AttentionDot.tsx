import type { AttentionTone } from "../lib/attention";

/** Dot color per tone. */
const DOT_CLASSES: Record<AttentionTone, string> = {
  warning: "bg-amber-500",
  error: "bg-red-600",
};

type AttentionDotProps = {
  tone: AttentionTone;
  /** Extra classes, e.g. for the position on a button. */
  className?: string;
};

/** Small colored dot that marks something needing attention. */
export function AttentionDot({ tone, className = "" }: AttentionDotProps) {
  return (
    <span
      aria-hidden
      className={`h-2.5 w-2.5 rounded-full ring-2 ring-surface ${DOT_CLASSES[tone]} ${className}`}
    />
  );
}
