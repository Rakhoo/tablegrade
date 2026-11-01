import type { ReactNode } from "react";
import type { LessonType } from "../lib/grades";
import { LESSON_TYPE_LABELS } from "../lib/lessons";

/** Small round label, by default on the primary color. */
export function Pill({
  children,
  color = "var(--color-brand-600)",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{ background: color }}
      className="rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-white uppercase"
    >
      {children}
    </span>
  );
}

/** Small label marking a lesson as exam or project; regular lessons show nothing. */
export function LessonTypeBadge({ type }: { type: LessonType }) {
  if (type == "normal") return null;
  return <Pill>{LESSON_TYPE_LABELS[type]}</Pill>;
}
