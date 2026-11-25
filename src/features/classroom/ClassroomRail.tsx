import { IconButton } from "@mui/material";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import { useSwipe } from "../../hooks/useSwipe";

type ClassroomRailProps = {
  back: ReactNode;
  title: ReactNode;
  subtitle: string;
  /** Seating plans of the previous and next lesson, `null` if there is none. */
  previous: string | null;
  next: string | null;
  history: ReactNode;
  modes: ReactNode;
  /** The mode's tools or hint. */
  children: ReactNode;
};

/** Arrow to the previous or next lesson, replacing the page so the way back stays the same. */
function LessonArrow({
  to,
  label,
  children,
}: {
  to: string | null;
  label: string;
  children: ReactNode;
}) {
  return (
    <IconButton
      component={Link}
      to={to ?? ""}
      replace
      disabled={!to}
      size="small"
      aria-label={label}
      className="bg-surface shadow-tile disabled:opacity-40"
    >
      {children}
    </IconButton>
  );
}

/**
 * Side bar of the seating plan in landscape: everything around the plan in one column, so the
 * plan gets the whole height. Swiping the title goes to the previous or next lesson.
 */
export function ClassroomRail({
  back,
  title,
  subtitle,
  previous,
  next,
  history,
  modes,
  children,
}: ClassroomRailProps) {
  const navigate = useNavigate();
  const swipe = useSwipe((direction) => {
    const to = direction == 1 ? next : previous;
    if (to) navigate(to, { replace: true });
  });
  return (
    <aside
      // No padding at the top: the way back sits level with the speed dial in the corner
      className="card flex w-72 shrink-0 flex-col gap-2 overflow-y-auto p-2 pt-0 compact:w-48"
      data-help-group
      data-help="Seitenleiste: Stunde, Modus, Rückgängig und die Werkzeuge des Modus."
    >
      {/* The way back in the top left corner, the speed dial covers the rest of the row */}
      <div className="flex h-11 shrink-0 items-center compact:h-10">{back}</div>
      <div
        {...swipe}
        className="flex touch-pan-y flex-col items-center gap-1 text-center"
        data-help="Klasse und Datum der Stunde; Pfeile oder Wischen über den Titel springen zur vorherigen oder nächsten Stunde."
      >
        <div className="flex flex-wrap items-center justify-center gap-1.5 leading-tight font-bold tracking-tight">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <LessonArrow to={previous} label="Vorherige Stunde">
            <ChevronLeftIcon size={20} />
          </LessonArrow>
          <span className="text-xs text-muted">{subtitle}</span>
          <LessonArrow to={next} label="Nächste Stunde">
            <ChevronRightIcon size={20} />
          </LessonArrow>
        </div>
      </div>
      <div className="flex justify-center">{history}</div>
      {modes}
      <div className="flex min-h-0 flex-col items-stretch gap-2 text-center text-sm text-muted">
        {children}
      </div>
    </aside>
  );
}
