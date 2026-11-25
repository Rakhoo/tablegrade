import { IconButton } from "@mui/material";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useSwipe } from "../hooks/useSwipe";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type PageHeaderProps = {
  /** The way back at the left. */
  back: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * Links of the arrows around the title, e.g. to the previous and next lesson; `null`
   * disables an arrow. Without both there are no arrows.
   */
  previous?: string | null;
  next?: string | null;
  /** Help text of the title with its arrows. */
  help?: string;
  /** Shown at the right end on small screens, e.g. the switch to the other page of the class. */
  action?: ReactNode;
};

/** Link of an arrow next to the title, replacing the page so the way back stays the same. */
function Arrow({
  to,
  label,
  icon,
}: {
  to: string | null;
  label: string;
  icon: ReactNode;
}) {
  return (
    <IconButton
      component={Link}
      to={to ?? ""}
      replace
      disabled={!to}
      aria-label={label}
      className="shrink-0 bg-surface shadow-tile disabled:opacity-40 compact:p-1.5"
    >
      {icon}
    </IconButton>
  );
}

/**
 * Header of a page: the way back at the left and the centered title, optionally between
 * arrows; swiping the title goes there too. The right end stays free for the speed dial. Small
 * screens center the title between the way back and `action` at the end.
 */
export function PageHeader({
  back,
  title,
  subtitle,
  previous,
  next,
  help,
  action,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const arrows = previous !== undefined || next !== undefined;
  const swipe = useSwipe((direction) => {
    const to = direction == 1 ? next : previous;
    if (to) navigate(to, { replace: true });
  });
  return (
    // Equal outer columns keep the title centered
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 compact:flex compact:gap-1">
      <div className="justify-self-start">{back}</div>
      <div
        className="flex items-center gap-3 compact:min-w-0 compact:flex-1 compact:justify-center compact:gap-1"
        data-help={
          help && arrows
            ? `${help} Wischen über den Titel wechselt ebenso.`
            : help
        }
      >
        {arrows && (
          <Arrow
            to={previous ?? null}
            label="Vorherige Stunde"
            icon={<ChevronLeftIcon />}
          />
        )}
        <div
          {...(arrows ? swipe : {})}
          className="min-w-56 touch-pan-y text-center portrait:min-w-44 compact:min-w-0 compact:flex-1"
        >
          <div className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight compact:gap-1.5 compact:text-base compact:leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="text-sm text-muted compact:truncate compact:text-xs">
              {subtitle}
            </div>
          )}
        </div>
        {arrows && (
          <Arrow
            to={next ?? null}
            label="Nächste Stunde"
            icon={<ChevronRightIcon />}
          />
        )}
      </div>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}
