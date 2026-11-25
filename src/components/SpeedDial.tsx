import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { rememberReturnPage } from "../lib/returnPage";
import { HelpOverlay } from "./help/HelpOverlay";
import { ChevronDownIcon, HelpIcon, SettingsIcon } from "./icons";
import { paths } from "../lib/paths";
import { AttentionDot } from "./AttentionDot";
import { useAttention } from "../hooks/useAttention";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { useCompact } from "../hooks/useCompact";
import { HelpSteps } from "./help/HelpSteps";
import { worstTone, type AttentionTone } from "../lib/attention";

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
  /** Dot on the icon, e.g. on the settings while something there needs a step. */
  attention?: AttentionTone | null;
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
 * One entry, a single raised pill: its label on the left, as wide as the widest of the dial,
 * and its icon on the right, set off by a tinted pill as wide as a toggle.
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
    attention,
  } = entry;
  const isToggle = checked != undefined;
  const content = (
    <>
      <span
        className={
          "flex h-11 flex-1 flex-col items-center justify-center px-3.5 text-center text-sm leading-tight font-medium " +
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
        <span className="relative flex h-11 w-[5.5rem] shrink-0 items-center rounded-full bg-brand-50">
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
            "relative flex h-11 w-[5.5rem] shrink-0 items-center justify-center rounded-full " +
            (danger ? "bg-red-600 text-white" : "bg-brand-50 text-brand-700")
          }
        >
          {icon}
          {attention && (
            <AttentionDot tone={attention} className="absolute top-1 right-5" />
          )}
        </span>
      )}
    </>
  );
  const className =
    `flex w-full items-center rounded-full bg-surface transition-transform active:scale-95 ${RAISED} ` +
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

/** Duration of the sheet's slide on small screens. */
const SHEET_MS = 250;

/** Delay between the entries while unfolding and folding. */
const STAGGER_MS = 20;

/** Where the dial sits: its corner on large screens, its bottom corner on small ones. */
type DialSide = "left" | "right";

type SpeedDialProps = {
  entries: SpeedDialEntry[];
  /**
   * Pages always shown left of the help, with their label in landscape. Small screens leave
   * them to the page, which shows them with `PageSwitch`.
   */
  links?: SpeedDialLink[];
  /** Asks before a link is followed, e.g. about unsaved input; calls `go` to follow it. */
  guard?: (go: () => void) => void;
  side?: DialSide;
};

/** No links next to the help; a constant, so the default stays the same between renders. */
const NO_LINKS: SpeedDialLink[] = [];

/** Shared state of both dials: the entries with the settings, open state and help. */
function useDial(entries: SpeedDialEntry[]) {
  const { pathname, search } = useLocation();
  const [openState, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const attention = worstTone(useAttention());
  const syncing = useSyncStatus().phase == "syncing";
  const all: SpeedDialEntry[] = [
    ...entries,
    {
      key: "settings",
      label: "Einstellungen",
      icon: <SettingsIcon />,
      help: "Schuljahre, Darstellung, Benotung, Sicherung und mehr. Ein Punkt zeigt, dass dort etwas zu tun ist.",
      to: paths.settings(),
      disabled: pathname == paths.settings(),
      attention,
    },
  ];
  // Without a usable entry the dial stays closed and empty, its button visibly disabled
  const usable = all.some((entry) => !entry.disabled);
  return {
    all,
    usable,
    open: openState && usable,
    setOpen,
    helpOpen,
    setHelpOpen,
    attention,
    syncing,
    /** Pages with a real way back name the page they were opened from */
    rememberFrom: (to: string) => rememberReturnPage(to, pathname + search),
  };
}

const CIRCLE = "flex h-11 w-11 items-center justify-center rounded-full";
const ROUND_BUTTON = `${CIRCLE} shadow-card transition-transform active:scale-95`;

type DialButtonProps = {
  dial: ReturnType<typeof useDial>;
  /** Icon of the closed dial. */
  icon: ReactNode;
};

/** The round button opening and closing the dial, with the dot of open points. */
function DialButton({ dial, icon }: DialButtonProps) {
  const { open, usable, syncing, attention, setOpen } = dial;
  return (
    <button
      type="button"
      aria-label={open ? "Menü schließen" : "Menü öffnen"}
      aria-expanded={open}
      disabled={!usable}
      className={
        "relative " +
        (usable
          ? `${ROUND_BUTTON} bg-brand-600 text-white`
          : `${CIRCLE} bg-line text-muted`) +
        // A running sync only tints the ring, so it stays unobtrusive
        (syncing ? " animate-pulse ring-2 ring-brand-300" : "")
      }
      data-help={
        usable
          ? "Öffnet das Menü mit allen weiteren Funktionen. Ein Punkt zeigt, dass in den Einstellungen etwas zu tun ist; ein pulsierender Rand, dass gerade abgeglichen wird."
          : "Hier gibt es gerade keine weiteren Funktionen."
      }
      onClick={() => setOpen(!open)}
    >
      {icon}
      {attention && !open && (
        <AttentionDot
          tone={attention}
          className="absolute -top-0.5 -right-0.5"
        />
      )}
    </button>
  );
}

/** Dark layer behind the open dial; a tap on it closes the dial. */
function Backdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={
        "fixed inset-0 z-[1150] bg-black/20 transition-opacity duration-200 " +
        (open ? "opacity-100" : "pointer-events-none opacity-0")
      }
      onClick={onClose}
    />
  );
}

/**
 * Speed dial in a top corner of large screens. Collapsed it only shows the help, the button
 * that opens it and links to the other pages of a class, if any; open it lists all features of
 * the page with their labels above everything else, the settings always last.
 */
function CornerDial({
  entries,
  links = NO_LINKS,
  guard,
  side = "right",
}: SpeedDialProps) {
  const dial = useDial(entries);
  const { all, usable, open, setOpen, helpOpen, setHelpOpen, rememberFrom } =
    dial;
  // The help explains the entries while open, and the page with the permanent buttons otherwise
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const shown = usable ? all : [];

  // Folding back takes as long as the last entry's delay plus its transition
  const closeMs = 200 + all.length * STAGGER_MS;
  return (
    <>
      <Backdrop open={open} onClose={() => setOpen(false)} />
      {/* The container spans the closed entries as well, so only its contents take taps */}
      <div
        className={
          "pointer-events-none absolute top-4 z-[1200] flex flex-col gap-2 " +
          (side == "right" ? "right-4 items-end" : "left-4 items-start")
        }
      >
        <div className="pointer-events-auto flex gap-2">
          {links.map((link) => (
            <PageSwitch key={link.key} link={link} wide />
          ))}
          <button
            type="button"
            aria-label="Hilfe"
            className={`${ROUND_BUTTON} bg-surface text-brand-700`}
            data-help="Erklärt die Seite, bei offenem Menü das Menü."
            onClick={() => setHelpOpen(true)}
          >
            <HelpIcon />
          </button>
          <DialButton
            dial={dial}
            icon={
              // Points sideways while closed and down while open
              <ChevronDownIcon
                className={
                  "transition-transform duration-200 " +
                  (open ? "" : side == "right" ? "rotate-90" : "-rotate-90")
                }
              />
            }
          />
        </div>
        {/* Always rendered, so closing can be animated as well; hidden once the entries are */}
        <nav
          ref={setNav}
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
          {shown.map((entry, index) => (
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
                transitionDelay: `${(open ? index : shown.length - 1 - index) * STAGGER_MS}ms`,
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
          scope={nav}
          inside={open}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Speed dial of small screens: a round button in a bottom corner, in reach of the thumb, that
 * opens all features of the page as a sheet from the bottom, the help and the settings last.
 */
function SheetDial({ entries, guard, side = "right" }: SpeedDialProps) {
  const dial = useDial(entries);
  const { all, usable, open, setOpen, helpOpen, setHelpOpen, rememberFrom } =
    dial;
  const help: SpeedDialEntry = {
    key: "help",
    label: "Hilfe",
    icon: <HelpIcon />,
    help: "Erklärt die Seite Schritt für Schritt.",
    // Once the sheet has left the screen, so its entries are not explained
    onClick: () => setTimeout(() => setHelpOpen(true), SHEET_MS),
  };
  const shown = usable ? [...all.slice(0, -1), help, ...all.slice(-1)] : [];
  return (
    <>
      <Backdrop open={open} onClose={() => setOpen(false)} />
      <div
        className="fixed z-[1200] mb-[env(safe-area-inset-bottom)]"
        style={{
          bottom: "0.75rem",
          [side]: "calc(env(safe-area-inset-" + side + ") + 0.75rem)",
        }}
      >
        <DialButton
          dial={dial}
          icon={
            <ChevronDownIcon
              className={
                "transition-transform duration-200 " +
                (open ? "" : "rotate-180")
              }
            />
          }
        />
      </div>
      <nav
        aria-label="Menü"
        aria-hidden={!open}
        className={
          "fixed inset-x-0 bottom-0 z-[1190] mx-auto flex max-h-[80dvh] max-w-md flex-col gap-2 overflow-y-auto rounded-t-[1.75rem] bg-canvas px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+4.25rem)] shadow-card transition-transform duration-250 ease-out " +
          (open ? "translate-y-0" : "pointer-events-none translate-y-full")
        }
      >
        <span className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-line" />
        {shown.map((entry) => (
          <SpeedDialItem
            key={entry.key}
            entry={entry}
            guard={guard}
            onClose={() => setOpen(false)}
            onNavigate={rememberFrom}
          />
        ))}
      </nav>
      {helpOpen && <HelpSteps onClose={() => setHelpOpen(false)} />}
    </>
  );
}

/** The speed dial fitting the screen: in a top corner, or as a sheet on small screens. */
function SpeedDial(props: SpeedDialProps) {
  return useCompact() ? <SheetDial {...props} /> : <CornerDial {...props} />;
}

type PageSwitchProps = {
  link: SpeedDialLink;
  /** Shows the label in landscape only, as large screens do next to the help. */
  wide?: boolean;
};

/** Link to another page of the class, e.g. from the seating plan to the overview table. */
export function PageSwitch({ link, wide = false }: PageSwitchProps) {
  const { pathname, search } = useLocation();
  const { label, icon, to, help } = link;
  return (
    <Link
      to={to}
      aria-label={label}
      data-help={help}
      onClick={() => rememberReturnPage(to, pathname + search)}
      className={
        "flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full shadow-card transition-transform active:scale-95 " +
        (wide
          ? "bg-surface text-brand-700 landscape:pr-4 landscape:pl-3"
          : "bg-brand-600 pr-4 pl-3 text-white")
      }
    >
      {icon}
      <span
        className={"text-sm font-medium " + (wide ? "portrait:hidden" : "")}
      >
        {label}
      </span>
    </Link>
  );
}

type SpeedDialLayoutProps = SpeedDialProps & {
  /** Classes of the content area. */
  className?: string;
  children: ReactNode;
};

/**
 * A page with the speed dial in its top corner (`side`). The page keeps that corner free, e.g.
 * with an empty end of its header. On small screens the dial is a round button in a bottom
 * corner instead, which bars at the bottom of the page keep free.
 */
export function SpeedDialLayout({
  entries,
  links,
  guard,
  side,
  className = "flex-col gap-3",
  children,
}: SpeedDialLayoutProps) {
  return (
    <div
      className={`relative flex h-full min-h-0 p-4 compact:p-2.5 ${className}`}
    >
      {children}
      <SpeedDial entries={entries} links={links} guard={guard} side={side} />
    </div>
  );
}
