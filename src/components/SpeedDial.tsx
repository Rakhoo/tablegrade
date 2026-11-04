import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { rememberReturnPage } from "../lib/returnPage";
import { HelpOverlay } from "./HelpOverlay";
import { ChevronDownIcon, HelpIcon, SettingsIcon } from "./icons";

/** An entry of the speed dial: a link, an action or a toggle. */
export type SpeedDialEntry = {
  key: string;
  label: string;
  /** Second line of the label, e.g. the date a link leads to. */
  detail?: string;
  icon: ReactNode;
  disabled?: boolean;
  /** Explanation shown by the help. */
  help: string;
  to?: string;
  onClick?: (element: HTMLElement) => void;
  /** State of a toggle; makes the entry a switch that keeps the dial open. */
  checked?: boolean;
  /** Icon of a toggle's off state, shown left of `icon` for the on state. */
  offIcon?: ReactNode;
  /** Keeps the dial open, e.g. for an entry opening a popover next to it. */
  keepOpen?: boolean;
  /** Marks an entry that deletes something in red. */
  danger?: boolean;
};

/** A page of the class, linked next to the help instead of inside the dial. */
export type SpeedDialLink = {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
  /** Explanation shown by the help. */
  help: string;
};

/** Shadow of the open entries, so they stand out from the page and each other. */
const RAISED = "shadow-[0_2px_10px_rgb(0_0_0/0.28)] ring-1 ring-black/10";

type SpeedDialItemProps = {
  entry: SpeedDialEntry;
  onClose: () => void;
  /** Called with the target before a link is followed. */
  onNavigate: (to: string) => void;
  /** Asks before a link is followed, see `SpeedDialProps.guard`. */
  guard?: (go: () => void) => void;
};

/**
 * One entry: its label on the left, as wide as the widest of the dial and as high as the
 * buttons, and its icon on the right, as wide as a toggle.
 */
function SpeedDialItem({
  entry,
  onClose,
  onNavigate,
  guard,
}: SpeedDialItemProps) {
  const navigate = useNavigate();
  const {
    label,
    detail,
    icon,
    offIcon,
    disabled,
    help,
    to,
    onClick,
    checked,
    keepOpen,
    danger,
  } = entry;
  const isToggle = checked != undefined;
  const content = (
    <>
      <span
        className={
          `flex h-11 flex-1 flex-col items-center justify-center rounded-full bg-surface px-3.5 text-center text-sm leading-tight font-medium ${RAISED} ` +
          (danger ? "text-red-600" : "text-ink")
        }
      >
        <span className="whitespace-nowrap">{label}</span>
        {detail && (
          <span className="text-xs font-normal whitespace-nowrap text-muted">
            {detail}
          </span>
        )}
      </span>
      {isToggle ? (
        // A switch with the icons of both states; the thumb covers the current one
        <span
          className={`relative flex h-11 w-[5.5rem] shrink-0 items-center rounded-full bg-surface ${RAISED}`}
        >
          <span
            className={
              "absolute top-1 left-1 h-9 w-10 rounded-full bg-brand-600 transition-transform " +
              (checked ? "translate-x-[2.5rem]" : "")
            }
          />
          <span
            className={
              "relative flex flex-1 justify-center transition-colors " +
              (checked ? "text-muted" : "text-white")
            }
          >
            {offIcon}
          </span>
          <span
            className={
              "relative flex flex-1 justify-center transition-colors " +
              (checked ? "text-white" : "text-muted")
            }
          >
            {icon}
          </span>
        </span>
      ) : (
        <span
          className={
            `flex h-11 w-[5.5rem] shrink-0 items-center justify-center rounded-full ${RAISED} ` +
            (danger ? "bg-red-600 text-white" : "bg-surface text-brand-700")
          }
        >
          {icon}
        </span>
      )}
    </>
  );
  const className =
    "flex w-full items-center justify-end gap-2 transition-transform active:scale-95 " +
    (disabled ? "pointer-events-none opacity-40" : "");
  if (to) {
    return (
      <Link
        to={to}
        aria-disabled={disabled}
        className={className}
        data-help={help}
        onClick={(event) => {
          const element = event.currentTarget;
          const go = () => {
            onNavigate(to);
            onClick?.(element);
            onClose();
          };
          if (!guard) return go();
          event.preventDefault();
          guard(() => {
            go();
            navigate(to);
          });
        }}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      role={isToggle ? "switch" : undefined}
      aria-checked={isToggle ? checked : undefined}
      className={className}
      data-help={help}
      onClick={(event) => {
        onClick?.(event.currentTarget);
        if (!isToggle && !keepOpen) onClose();
      }}
    >
      {content}
    </button>
  );
}

/** Delay between the entries while unfolding and folding. */
const STAGGER_MS = 20;

type SpeedDialProps = {
  entries: SpeedDialEntry[];
  /** Pages always shown left of the help, with their label in landscape. */
  links?: SpeedDialLink[];
  /** Asks before a link is followed, e.g. about unsaved input; calls `go` to follow it. */
  guard?: (go: () => void) => void;
};

/**
 * Speed dial in the top right corner. Collapsed it only shows the help, the button that
 * opens it and links to the other pages of a class, if any; open it lists all features of the page, with their labels, above everything else.
 * The settings are always the last entry.
 */
export function SpeedDial({ entries, links = [], guard }: SpeedDialProps) {
  const { pathname, search } = useLocation();
  // Pages with a real way back name the page they were opened from
  const rememberFrom = (to: string) =>
    rememberReturnPage(to, pathname + search);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // The help explains the entries while open, and the page with the permanent buttons otherwise
  const [dial, setDial] = useState<HTMLElement | null>(null);
  const all: SpeedDialEntry[] = [
    ...entries,
    {
      key: "settings",
      label: "Einstellungen",
      icon: <SettingsIcon />,
      help: "Schuljahre, Darstellung, Benotung, Sicherung und mehr.",
      to: "/settings",
      disabled: pathname == "/settings",
    },
  ];

  // Folding back takes as long as the last entry's delay plus its transition
  const closeMs = 200 + all.length * STAGGER_MS;
  const roundButton =
    "flex h-11 w-11 items-center justify-center rounded-full shadow-card transition-transform active:scale-95";
  return (
    <>
      <div
        className={
          "fixed inset-0 z-[1150] bg-black/20 transition-opacity duration-200 " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setOpen(false)}
      />
      {/* The container spans the closed entries as well, so only its contents take taps */}
      <div className="pointer-events-none absolute top-4 right-4 z-[1200] flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex gap-2">
          {links.map(({ key, label, icon, to, help }) => (
            <Link
              key={key}
              to={to}
              aria-label={label}
              data-help={help}
              onClick={() => rememberFrom(to)}
              className={
                "flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-surface text-brand-700 shadow-card transition-transform active:scale-95 landscape:pr-4 landscape:pl-3 "
              }
            >
              {icon}
              <span className="text-sm font-medium portrait:hidden">
                {label}
              </span>
            </Link>
          ))}
          <button
            type="button"
            aria-label="Hilfe"
            className={`${roundButton} bg-surface text-brand-700`}
            data-help="Erklärt alles, was auf der Seite zu sehen ist. Bei geöffnetem Menü erklärt sie stattdessen das Menü."
            onClick={() => setHelpOpen(true)}
          >
            <HelpIcon />
          </button>
          <button
            type="button"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={open}
            className={`${roundButton} bg-brand-600 text-white`}
            data-help="Öffnet und schließt das Menü mit allen weiteren Funktionen der Seite."
            onClick={() => setOpen(!open)}
          >
            {/* Points left while closed and down while open */}
            <ChevronDownIcon
              className={
                "transition-transform duration-200 " + (open ? "" : "rotate-90")
              }
            />
          </button>
        </div>
        {/* Always rendered, so closing can be animated as well; hidden once the entries are */}
        <nav
          ref={setDial}
          aria-label="Menü"
          aria-hidden={!open}
          className={
            "flex max-h-[calc(100dvh-6rem)] flex-col items-stretch gap-2 overflow-y-auto p-1 " +
            (open ? "pointer-events-auto" : "")
          }
          style={{
            visibility: open ? "visible" : "hidden",
            transition: `visibility 0s linear ${open ? 0 : closeMs}ms`,
          }}
        >
          {all.map((entry, index) => (
            <div
              key={entry.key}
              className={
                "transition-[opacity,transform] duration-200 ease-out " +
                (open
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-3 opacity-0")
              }
              // Unfolds from the top, folds back from the bottom
              style={{
                transitionDelay: `${(open ? index : all.length - 1 - index) * STAGGER_MS}ms`,
              }}
            >
              <SpeedDialItem
                entry={entry}
                guard={guard}
                onClose={() => setOpen(false)}
                onNavigate={rememberFrom}
              />
            </div>
          ))}
        </nav>
      </div>
      {helpOpen && (
        // Explaining both at once would crowd the screen
        <HelpOverlay
          scope={dial}
          inside={open}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}

type SpeedDialLayoutProps = SpeedDialProps & {
  /** Classes of the content area. */
  className?: string;
  children: ReactNode;
};

/**
 * A page with the speed dial in its top right corner. The page keeps that corner free, e.g.
 * with an empty right end of its header.
 */
export function SpeedDialLayout({
  entries,
  links,
  guard,
  className = "flex-col gap-3",
  children,
}: SpeedDialLayoutProps) {
  return (
    <div className={`relative flex h-full min-h-0 p-4 ${className}`}>
      {children}
      <SpeedDial entries={entries} links={links} guard={guard} />
    </div>
  );
}
