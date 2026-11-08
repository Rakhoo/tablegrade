import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { area, type Line, type Rect } from "./geometry";
import { placeCallouts } from "./placement";
import { collectTargets, createClipper, scrollerAt } from "./targets";

/** Opened cards up to this share of the screen get the callouts of their elements outside. */
const OUTSIDE_SHARE = 0.4;

/** Movement in pixels from which a touch scrolls instead of closing the help. */
const DRAG_THRESHOLD = 8;

type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
  line?: Line;
  /** Top left corner of the element when placed, to follow it while scrolling. */
  anchor: { x: number; y: number };
};

/** Position of a frame drawn just outside a rectangle. */
const frameStyle = (rect: Rect) => ({
  left: rect.left - 3,
  top: rect.top - 3,
  width: rect.right - rect.left + 6,
  height: rect.bottom - rect.top + 6,
});

// Stable keys of the explained elements, as the list changes while scrolling
const keys = new WeakMap<HTMLElement, number>();

let nextKey = 0;

const keyOf = (element: HTMLElement) => {
  if (!keys.has(element)) keys.set(element, nextKey++);
  return keys.get(element)!;
};

type HelpOverlayProps = {
  /** The part of the page to explain, see `inside`. */
  scope: HTMLElement | null;
  /** Explains the elements inside `scope`, otherwise all others. */
  inside: boolean;
  onClose: () => void;
};

/**
 * Explains what is currently on the screen: every element with a `data-help` text gets a
 * callout, connected to it by a line. Cards (`data-help-group`) only get a short explanation
 * with "Mehr anzeigen", which hides everything else and explains their inner elements, with
 * the callouts outside the card. Swiping scrolls the page below, the callouts follow their
 * elements, and repeated explanations move to the best visible element. A tap anywhere closes
 * the explanations.
 */
export function HelpOverlay({ scope, inside, onClose }: HelpOverlayProps) {
  // The cards opened with "Mehr anzeigen", innermost last
  const [path, setPath] = useState<HTMLElement[]>([]);
  const group = path.at(-1) ?? null;
  const [targets, setTargets] = useState(() =>
    collectTargets(scope, inside, null),
  );
  const [placements, setPlacements] = useState(
    () => new Map<HTMLElement, Placement>(),
  );
  const overlay = useRef<HTMLDivElement>(null);
  const callouts = useRef(new Map<HTMLElement, HTMLDivElement>());
  const closingHint = useRef<HTMLDivElement>(null);
  const latestTargets = useRef(targets);
  useEffect(() => {
    latestTargets.current = targets;
  }, [targets]);
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    scroller: Element | null;
  } | null>(null);

  const open = (next: HTMLElement[]) => {
    setPath(next);
    setTargets(collectTargets(scope, inside, next.at(-1) ?? null));
    setPlacements(new Map());
  };

  // New callouts are first rendered invisibly, so they can be measured before they are placed
  useLayoutEffect(() => {
    const missing = targets.filter(({ element }) => !placements.has(element));
    if (missing.length == 0) return;
    const hint = closingHint.current?.getBoundingClientRect();
    // The opened card stays free, so its elements are seen next to their callouts; a card
    // filling most of the screen, like a table, leaves no room outside, so it cannot
    const card = group && createClipper()(group).rect;
    const reserved = [
      ...(hint ? [hint] : []),
      ...(card && area(card) < innerWidth * innerHeight * OUTSIDE_SHARE
        ? [card]
        : []),
    ];
    const fixed = [...placements.values()].map((placement) => ({
      box: {
        left: placement.left,
        top: placement.top,
        right: placement.left + placement.width,
        bottom: placement.top + placement.height,
      },
      line: placement.line,
    }));
    const items = missing.map(({ element, rect, place }) => {
      const callout = callouts.current.get(element);
      return {
        rect,
        place,
        width: callout?.offsetWidth ?? 0,
        height: callout?.offsetHeight ?? 0,
      };
    });
    const results = placeCallouts(items, targets, reserved, fixed);
    const next = new Map(placements);
    // Anchored where the element was when its rectangle was measured, so callout, line and
    // frame stay together even if the page scrolled in between
    missing.forEach(({ element, origin }, index) => {
      const { box, line } = results[index];
      next.set(element, {
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
        line,
        anchor: origin,
      });
    });
    // Placing needs the measured callouts, so it cannot happen during rendering
    // oxlint-disable-next-line react/set-state-in-effect
    setPlacements(next);
  }, [targets, placements, group]);

  // While the page scrolls, callouts follow their elements; elements scrolled out of view lose
  // theirs, newly visible ones get one
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = collectTargets(scope, inside, group, latestTargets.current);
      setTargets(next);
      setPlacements((current) => {
        const moved = new Map<HTMLElement, Placement>();
        // Moved by the positions measured with the frames, not by later ones
        for (const { element, origin } of next) {
          const placement = current.get(element);
          if (!placement) continue;
          const dx = origin.x - placement.anchor.x;
          const dy = origin.y - placement.anchor.y;
          const { line } = placement;
          moved.set(element, {
            ...placement,
            left: placement.left + dx,
            top: placement.top + dy,
            line: line && {
              x1: line.x1 + dx,
              y1: line.y1 + dy,
              x2: line.x2 + dx,
              y2: line.y2 + dy,
            },
            anchor: origin,
          });
        }
        return moved;
      });
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      cancelAnimationFrame(frame);
    };
  }, [scope, inside, group]);

  useEffect(() => {
    window.addEventListener("resize", onClose);
    return () => window.removeEventListener("resize", onClose);
  }, [onClose]);

  // A swipe scrolls what lies below, a tap closes the help
  const pointerHandlers = {
    onPointerDown: (event: PointerEvent) => {
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        scroller: scrollerAt(event.clientX, event.clientY, overlay.current),
      };
    },
    onPointerMove: (event: PointerEvent) => {
      const current = drag.current;
      if (!current) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      current.moved = true;
      current.scroller?.scrollBy(-dx, -dy);
      current.x = event.clientX;
      current.y = event.clientY;
    },
    onPointerUp: (event: PointerEvent) => {
      const moved = drag.current?.moved;
      drag.current = null;
      if (!moved && !(event.target as Element).closest("button")) onClose();
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  };

  return createPortal(
    <div
      ref={overlay}
      className="fixed inset-0 z-[2000] touch-none select-none"
      data-help-overlay
      {...pointerHandlers}
      onWheel={(event) =>
        scrollerAt(event.clientX, event.clientY, overlay.current)?.scrollBy(
          event.deltaX,
          event.deltaY,
        )
      }
      role="dialog"
      aria-label="Hilfe"
    >
      <div className="absolute inset-0 bg-black/45" />
      {group && (
        // The opened card, without its general explanation
        <div
          className="absolute rounded-xl ring-2 ring-brand-300"
          style={frameStyle(createClipper()(group).rect)}
        />
      )}
      {targets.map(({ element, frame, skew }) => (
        <div
          key={`frame-${keyOf(element)}`}
          className="absolute origin-bottom rounded-xl ring-2 ring-white/90"
          style={{
            ...frameStyle(frame),
            transform: skew ? `skewX(${skew}deg)` : undefined,
          }}
        />
      ))}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {targets.map(({ element }) => {
          const line = placements.get(element)?.line;
          return (
            line && (
              <g key={keyOf(element)} className="text-white">
                <line
                  {...line}
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle cx={line.x2} cy={line.y2} r={4} fill="currentColor" />
              </g>
            )
          );
        })}
      </svg>
      {targets.map(({ element, text, group: card }) => {
        const placement = placements.get(element);
        return (
          <div
            key={`callout-${keyOf(element)}`}
            ref={(callout) => {
              if (callout) callouts.current.set(element, callout);
              else callouts.current.delete(element);
            }}
            className="absolute w-max max-w-56 rounded-xl bg-surface px-3 py-2 text-sm leading-snug text-ink shadow-[0_4px_18px_rgb(0_0_0/0.45)] ring-1 ring-black/15"
            style={
              placement
                ? { left: placement.left, top: placement.top }
                : { left: 0, top: 0, visibility: "hidden" }
            }
          >
            {text}
            {card && (
              <button
                type="button"
                className="ml-1 font-semibold text-brand-600"
                onClick={(event) => {
                  event.stopPropagation();
                  open([...path, card]);
                }}
              >
                Mehr anzeigen
              </button>
            )}
          </div>
        );
      })}
      <div
        ref={closingHint}
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2"
      >
        {group && (
          <button
            type="button"
            className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-brand-700 shadow-card"
            onClick={(event) => {
              event.stopPropagation();
              open(path.slice(0, -1));
            }}
          >
            Zurück
          </button>
        )}
        <span className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-card">
          Zum Schließen irgendwo tippen
        </span>
      </div>
    </div>,
    document.body,
  );
}
