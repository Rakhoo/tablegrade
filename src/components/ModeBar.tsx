import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { ReactNode } from "react";

/** A mode with its button. */
export type ModeOption<T extends string> = {
  value: T;
  label: string;
  /** Explanation shown by the help. */
  help: string;
  disabled?: boolean;
};

type ModeToggleProps<T extends string> = {
  options: ModeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** "full": spread over the whole width; "grid": two columns, e.g. in the side bar. */
  layout?: "row" | "full" | "grid";
};

/** Classes of the group per layout. */
const TOGGLE_LAYOUTS = {
  row: "rounded-full",
  full: "flex w-full rounded-full",
  grid: "grid grid-cols-2 gap-0.5 rounded-2xl",
};

/** Choice of the page's mode as a row of text toggle buttons. */
export function ModeToggle<T extends string>({
  options,
  value,
  onChange,
  layout = "row",
}: ModeToggleProps<T>) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      aria-label="Modus"
      value={value}
      onChange={(_, next: T | null) => next && onChange(next)}
      className={`bg-brand-50 p-0.5 ${TOGGLE_LAYOUTS[layout]}`}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={
            "toggle-pill px-2.5 py-0.5 text-xs leading-5 " +
            (layout == "row" ? "" : "flex-1 px-1 py-1.5")
          }
          data-help={option.help}
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

type ModeBarProps = {
  /** The mode choice in the top left corner. */
  modes: ReactNode;
  /** Undo and redo in the top right corner. */
  history: ReactNode;
  /** Explanation of the current mode, below them. */
  hint?: ReactNode;
  /** Tools of the current mode, below. */
  children?: ReactNode;
  /** A notice in a gray strip at the bottom, e.g. about a filter. */
  footer?: ReactNode;
  /** Label of the current mode, named in the help. */
  current: string;
};

/**
 * Bar below the header: the mode choice and undo/redo small in its top corners, the mode's
 * hint and tools below them and an optional notice as a gray footer.
 */
export function ModeBar({
  modes,
  history,
  hint,
  children,
  footer,
  current,
}: ModeBarProps) {
  return (
    <div
      className="card flex flex-col gap-1 overflow-hidden px-1.5 pt-1.5 pb-1.5"
      data-help-group
      data-help={`Modus-Auswahl, Rückgängig und die Werkzeuge des Modus. Aktueller Modus: ${current}.`}
    >
      <div className="flex items-start justify-between gap-2">
        {modes}
        {history}
      </div>
      {hint && (
        <div className="flex items-center justify-center px-2 text-center text-sm text-muted">
          {hint}
        </div>
      )}
      {children}
      {footer && (
        <div className="-mx-1.5 -mb-1.5 flex flex-wrap items-center justify-center gap-x-1 border-t border-line bg-line/50 px-3 py-0.5 text-sm text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}

type BottomBarProps = {
  /** The mode choice, spread over the whole width. */
  modes: ReactNode;
  /** Undo and redo as round buttons. */
  history: ReactNode;
  /** Tools or hint of the current mode, next to undo and redo. */
  children?: ReactNode;
  /** Label of the current mode, named in the help. */
  current: string;
};

/**
 * The mode bar of small screens, at the bottom in reach of the thumb: the mode choice above,
 * undo, redo and the mode's tools or hint below, the right end free for the round menu button.
 */
export function BottomBar({
  modes,
  history,
  children,
  current,
}: BottomBarProps) {
  return (
    <div
      // Short screens put everything into one row, so the page keeps its height
      className="card flex shrink-0 flex-col gap-1.5 p-1.5 short:flex-row short:items-center"
      data-help-group
      data-help={`Modus-Auswahl, Rückgängig und die Werkzeuge des Modus. Aktueller Modus: ${current}.`}
    >
      <div className="short:w-80 short:shrink-0">{modes}</div>
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-1.5 pr-12">
        {history}
        <div className="flex min-w-0 flex-1 justify-center text-center text-xs text-muted">
          {children}
        </div>
      </div>
    </div>
  );
}
