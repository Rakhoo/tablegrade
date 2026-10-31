import type { LessonType } from "../lib/grades";
import { LESSON_TYPE_LABELS } from "../lib/lessons";

/** Small label marking a lesson as exam or project; regular lessons show nothing. */
export function LessonTypeBadge({ type }: { type: LessonType }) {
  if (type == "normal") return null;
  return (
    <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-white uppercase">
      {LESSON_TYPE_LABELS[type]}
    </span>
  );
}
