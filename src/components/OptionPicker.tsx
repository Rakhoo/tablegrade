import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** One choice of the picker. */
export type PickOption = {
  key: string;
  /** Text of the preview above the finger and for screen readers. */
  label: string;
  content: ReactNode;
  danger?: boolean;
};

/** A titled grid of choices; `null` leaves a cell empty, e.g. the missing "6+". */
export type PickSection = {
  key: string;
  title?: string;
  columns: number;
  options: (PickOption | null)[];
  /** Takes a row of its own instead of sharing it with the next section. */
  full?: boolean;
  /** Cells share the row's width, e.g. for labeled choices; otherwise they are square. */
  stretch?: boolean;
};

/** What the picker offers, where it opened and what a choice does. */
export type PickRequest = {
  /** The element the picker belongs to, e.g. the tool button or a seat. */
  anchor: DOMRect;
  title?: string;
  sections: PickSection[];
  /** Key of the current choice, highlighted. */
  selected?: string;
  /** Whether the finger is still down: releasing it on a choice picks it. */
  held: boolean;
  onPick: (key: string) => void;
};

/** Room in pixels kept to the screen edges and the anchor. */
const MARGIN = 8;

/** Distance in pixels from the choice to the bottom of its preview, above the fingertip. */
const BUBBLE_GAP = 56;

/** Room in pixels the preview needs at the screen edges: half its width and its height. */
const BUBBLE_HALF = 80;
const BUBBLE_HEIGHT = 110;

type Size = { width: number; height: number };

/** Top left corner of the picker: above, below, left or right of the anchor, where it fits. */
function place(anchor: DOMRect, { width, height }: Size) {
  const fitsX = (left: number) =>
    left >= MARGIN && left + width <= innerWidth - MARGIN;
  const fitsY = (top: number) =>
    top >= MARGIN && top + height <= innerHeight - MARGIN;
  const clampX = (left: number) =>
    Math.min(Math.max(left, MARGIN), innerWidth - width - MARGIN);
  const clampY = (top: number) =>
    Math.min(Math.max(top, MARGIN), innerHeight - height - MARGIN);
  const centerX = clampX(anchor.left + anchor.width / 2 - width / 2);
  const centerY = clampY(anchor.top + anchor.height / 2 - height / 2);
  const candidates = [
    { left: centerX, top: anchor.top - height - MARGIN },
    { left: centerX, top: anchor.bottom + MARGIN },
    { left: anchor.left - width - MARGIN, top: centerY },
    { left: anchor.right + MARGIN, top: centerY },
  ];
  return (
    candidates.find(({ left, top }) => fitsX(left) && fitsY(top)) ?? {
      left: centerX,
      top: clampY(anchor.top - height - MARGIN),
    }
  );
}

/** The choice under a point, if any. */
const optionAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-pick]") ?? null;

type OptionPickerProps = {
  request: PickRequest;
  onClose: () => void;
};

/**
 * Choices in a panel next to their anchor. While the finger is down (`held`) sliding marks a
 * choice, shown enlarged above the finger, and releasing picks it. Releasing outside cancels once
 * the finger was in the panel; before that, e.g. after a tap on the anchor, the panel stays open,
 * so choices can be tapped as well.
 */
export function OptionPicker({ request, onClose }: OptionPickerProps) {
  const { anchor, title, sections, selected, onPick } = request;
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const [held, setHeld] = useState(request.held);
  const [hover, setHover] = useState<{ key: string; rect: DOMRect } | null>(
    null,
  );
  /** Whether the held finger has been in the panel, after which releasing outside cancels. */
  const entered = useRef(false);

  useLayoutEffect(() => {
    if (!panel.current) return;
    // Measuring needs the rendered panel, so this cannot happen during rendering
    // oxlint-disable-next-line react/set-state-in-effect
    setPosition(place(anchor, panel.current.getBoundingClientRect()));
  }, [anchor]);

  // While held, the finger is followed on the whole screen, as it started on the anchor
  useEffect(() => {
    if (!held) return;
    const handleMove = (event: PointerEvent) => {
      const box = panel.current?.getBoundingClientRect();
      if (
        box &&
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom
      )
        entered.current = true;
      const option = optionAt(event.clientX, event.clientY);
      setHover(
        option
          ? { key: option.dataset.pick!, rect: option.getBoundingClientRect() }
          : null,
      );
    };
    const handleUp = (event: PointerEvent) => {
      const key = optionAt(event.clientX, event.clientY)?.dataset.pick;
      setHover(null);
      if (key) {
        onPick(key);
        onClose();
      } else if (entered.current) onClose();
      else setHeld(false);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", onClose);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", onClose);
    };
  }, [held, onPick, onClose]);

  const hovered = hover && findOption(sections, hover.key);
  return createPortal(
    <div className="fixed inset-0 z-[1400] touch-none select-none">
      {/* Closes on a new touch outside: the click that follows the opening tap lands here too,
          as the panel now covers the spot, and must not close it */}
      <div className="absolute inset-0" onPointerDown={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-label={title ?? "Auswahl"}
        className="absolute flex w-max max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-2xl bg-surface p-2.5 shadow-[0_8px_32px_rgb(0_0_0/0.3)] ring-1 ring-black/10"
        style={position ?? { left: 0, top: 0, visibility: "hidden" }}
      >
        {title && (
          <div className="text-xs font-semibold text-muted">{title}</div>
        )}
        {toRows(sections).map((row) => (
          <div key={row[0].key} className="flex flex-wrap gap-x-3 gap-y-2">
            {row.map((section) => (
              <div key={section.key} className="flex flex-1 flex-col gap-1">
                {section.title && (
                  <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">
                    {section.title}
                  </span>
                )}
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: section.stretch
                      ? `repeat(${section.columns}, minmax(0, 1fr))`
                      : `repeat(${section.columns}, 2.5rem)`,
                  }}
                >
                  {section.options.map((option, index) =>
                    option ? (
                      <button
                        key={option.key}
                        type="button"
                        data-pick={option.key}
                        aria-label={option.label}
                        aria-pressed={option.key == selected}
                        className={
                          "flex h-10 items-center justify-center gap-1 rounded-xl px-1.5 text-xs font-semibold whitespace-nowrap transition-transform " +
                          (hover?.key == option.key
                            ? "scale-110 bg-brand-600 text-white"
                            : option.key == selected
                              ? "bg-brand-100 ring-2 ring-brand-300"
                              : "bg-brand-50") +
                          (option.danger ? " text-red-600" : "")
                        }
                        onClick={() => {
                          onPick(option.key);
                          onClose();
                        }}
                      >
                        {option.content}
                      </button>
                    ) : (
                      // Empty cells have no data to key them by
                      // oxlint-disable-next-line react/no-array-index-key
                      <span key={`empty-${index}`} />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {hovered && hover && (
        // The finger covers the choice and its surroundings, so it is repeated large and well
        // above it, kept on the screen
        <div
          className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1 rounded-3xl bg-ink px-5 pt-4 pb-2 text-surface shadow-card"
          style={{
            left: Math.min(
              Math.max(hover.rect.left + hover.rect.width / 2, BUBBLE_HALF),
              innerWidth - BUBBLE_HALF,
            ),
            top: Math.max(hover.rect.top - BUBBLE_GAP, BUBBLE_HEIGHT),
          }}
        >
          <span className="flex scale-[1.8] items-center py-2">
            {hovered.option.content}
          </span>
          <span className="text-sm font-semibold whitespace-nowrap">
            {hovered.section.title
              ? `${hovered.option.label} · ${hovered.section.title}`
              : hovered.option.label}
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Sections in rows: a full section alone, others side by side (wrapping when narrow). */
function toRows(sections: PickSection[]) {
  const rows: PickSection[][] = [];
  for (const section of sections) {
    const last = rows.at(-1);
    if (section.full || !last || last[0].full) rows.push([section]);
    else last.push(section);
  }
  return rows;
}

/** A choice with the section it belongs to. */
function findOption(sections: PickSection[], key: string) {
  for (const section of sections) {
    const option = section.options.find((candidate) => candidate?.key == key);
    if (option) return { option, section };
  }
  return null;
}
