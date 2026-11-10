import type { ReactNode } from "react";
import { Raven } from "./brand/Raven";

type EmptyStateProps = {
  title: string;
  /** What to do next, below the title. */
  children: ReactNode;
  /** `light` on colored areas like the seating plan, `muted` on cards. */
  tone: "light" | "muted";
};

/** Placeholder of an empty page area: the mascot with a title and a hint. */
export function EmptyState({ title, children, tone }: EmptyStateProps) {
  return (
    <div
      className={
        "flex h-full flex-col items-center justify-center gap-1 p-6 text-center " +
        (tone == "light" ? "text-white/80" : "text-muted")
      }
    >
      <Raven
        className={
          "mb-3 h-36 " + (tone == "light" ? "text-white/85" : "text-brand-300")
        }
      />
      <span
        className={
          "text-lg font-semibold " +
          (tone == "light" ? "text-white" : "text-ink")
        }
      >
        {title}
      </span>
      {children}
    </div>
  );
}
