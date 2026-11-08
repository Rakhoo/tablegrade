import { IconButton } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router";
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
      className="bg-surface shadow-tile disabled:opacity-40"
    >
      {icon}
    </IconButton>
  );
}

/**
 * Header of a page: the way back at the left and the centered title, optionally between
 * arrows; the right end stays free for the speed dial.
 */
export function PageHeader({
  back,
  title,
  subtitle,
  previous,
  next,
  help,
}: PageHeaderProps) {
  const arrows = previous !== undefined || next !== undefined;
  return (
    // Equal outer columns keep the title centered
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <div className="justify-self-start">{back}</div>
      <div className="flex items-center gap-3" data-help={help}>
        {arrows && (
          <Arrow
            to={previous ?? null}
            label="Vorherige Stunde"
            icon={<ChevronLeftIcon />}
          />
        )}
        <div className="min-w-56 text-center portrait:min-w-44">
          <div className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight">
            {title}
          </div>
          {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
        </div>
        {arrows && (
          <Arrow
            to={next ?? null}
            label="Nächste Stunde"
            icon={<ChevronRightIcon />}
          />
        )}
      </div>
      <div />
    </header>
  );
}
