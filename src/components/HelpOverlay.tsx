import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

/** Space kept free around elements and callouts. */
const PADDING = 6;
/** Distance of the callouts to the screen edge. */
const MARGIN = 8;
/** Elements covering more of the screen get their callout inside, e.g. the seating plan. */
const LARGE_SHARE = 0.12;
/** Opened cards up to this share of the screen get the callouts of their elements outside. */
const OUTSIDE_SHARE = 0.4;
/** Gaps between an element and its callout that are tried, closest first. */
const DISTANCES = [24, 40, 64, 96, 136, 184, 240, 310, 400];
/** Directions tried around an element. */
const DIRECTIONS = 16;
/** Extra cost of a callout above or below its element instead of beside it, in pixels. */
const ROW_PENALTY = 600;
/** Extra cost of a line running along another one; crossing is fine. */
const LINE_PENALTY = 3000;
/** Lines closer than this, in pixels, run along each other. */
const LINE_TOLERANCE = 6;
/** Repeated elements checked for being covered, best ranked first. */
const COVER_CHECKS = 12;
/** Step of the positions tried inside a large element. */
const INSIDE_STEP = 24;
/** Movement in pixels from which a touch scrolls instead of closing the help. */
const DRAG_THRESHOLD = 8;

type Rect = { left: number; top: number; right: number; bottom: number };
/** Where a callout should go (`data-help-place`): inside its element, centered, or above or below it. */
type Preference = "inside" | "above" | "below";
type Target = {
  element: HTMLElement;
  /** The visible part of the element; for a slanted one the area it covers. */
  rect: Rect;
  /** The visible part of the element before slanting, framed with the same slant. */
  frame: Rect;
  /** Top left corner of the whole element when collected, measured with `rect`. */
  origin: { x: number; y: number };
  /** Slant of the element (`data-help-skew`, in degrees, around its bottom edge). */
  skew: number;
  place?: Preference;
  text: string;
  /** A card whose inner elements "Mehr anzeigen" explains. */
  group?: HTMLElement;
};
type Line = { x1: number; y1: number; x2: number; y2: number };
type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
  line?: Line;
  /** Top left corner of the element when placed, to follow it while scrolling. */
  anchor: { x: number; y: number };
};

const area = (rect: Rect) =>
  Math.max(rect.right - rect.left, 0) * Math.max(rect.bottom - rect.top, 0);

const intersect = (a: Rect, b: Rect): Rect => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
});

const overlap = (a: Rect, b: Rect) => area(intersect(a, b));

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Position of a frame drawn just outside a rectangle. */
const frameStyle = (rect: Rect) => ({
  left: rect.left - 3,
  top: rect.top - 3,
  width: rect.right - rect.left + 6,
  height: rect.bottom - rect.top + 6,
});

const inflate = (rect: Rect, by: number): Rect => ({
  left: rect.left - by,
  top: rect.top - by,
  right: rect.right + by,
  bottom: rect.bottom + by,
});

const screenRect = (): Rect => ({
  left: 0,
  top: 0,
  right: innerWidth,
  bottom: innerHeight,
});

/** Whether two lines run along each other for a stretch, instead of merely crossing. */
function linesAlong(a: Line, b: Line) {
  const length = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
  if (length < 1) return false;
  const ux = (a.x2 - a.x1) / length;
  const uy = (a.y2 - a.y1) / length;
  const project = (x: number, y: number) => ({
    along: (x - a.x1) * ux + (y - a.y1) * uy,
    across: Math.abs((x - a.x1) * uy - (y - a.y1) * ux),
  });
  const start = project(b.x1, b.y1);
  const end = project(b.x2, b.y2);
  if (start.across > LINE_TOLERANCE || end.across > LINE_TOLERANCE)
    return false;
  const from = Math.max(Math.min(start.along, end.along), 0);
  const to = Math.min(Math.max(start.along, end.along), length);
  return to - from > LINE_TOLERANCE;
}

/**
 * Creates a function returning the visible part of an element: cut to the screen and to every
 * ancestor that clips its content, like a scrolled table. The ancestors' styles are looked up
 * once per function.
 */
function createClipper() {
  const clips = new Map<Element, boolean>();
  const clipsContent = (element: Element) => {
    let value = clips.get(element);
    if (value == undefined) {
      const { overflowX, overflowY } = getComputedStyle(element);
      value = overflowX != "visible" || overflowY != "visible";
      clips.set(element, value);
    }
    return value;
  };
  return (element: HTMLElement) => {
    const box: Rect = element.getBoundingClientRect();
    let rect = box;
    // The visible area of the innermost clipping ancestor, to rank repeated elements
    let view: Rect | null = null;
    for (
      let parent = element.parentElement;
      parent && parent != document.body;
      parent = parent.parentElement
    ) {
      if (!clipsContent(parent)) continue;
      const box = parent.getBoundingClientRect();
      view ??= intersect(box, screenRect());
      rect = intersect(rect, box);
    }
    return {
      rect: intersect(rect, screenRect()),
      view: view ?? screenRect(),
      origin: { x: box.left, y: box.top },
    };
  };
}

/** Whether something covers part of an element, checked at its center and near its corners. */
function isCovered(element: HTMLElement, rect: Rect) {
  const inset = 3;
  const points = [
    [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
    [rect.left + inset, rect.top + inset],
    [rect.right - inset, rect.top + inset],
    [rect.left + inset, rect.bottom - inset],
    [rect.right - inset, rect.bottom - inset],
  ];
  return points.some(([x, y]) => {
    // The help itself lies above everything
    const top = document
      .elementsFromPoint(x, y)
      .find((other) => !other.closest("[data-help-overlay]"));
    return !top || !element.contains(top);
  });
}

/** The card (`data-help-group`) an element lies in, not counting the element itself. */
const groupOf = (element: HTMLElement) =>
  element.parentElement?.closest<HTMLElement>("[data-help-group]") ?? null;

/**
 * All visible elements with a `data-help` text directly in `group` (on the page itself without
 * one): those inside `scope`, or with `inside` false all others. Elements inside a card are
 * left to its "Mehr anzeigen", which only cards with such elements offer. Of the elements
 * marked `data-help-repeat` sharing a text only one is explained: the one shown before while
 * still fully visible (not cut off or covered), otherwise the fully visible one closest to the
 * middle of its visible area.
 */
function collectTargets(
  scope: HTMLElement | null,
  inside: boolean,
  group: HTMLElement | null,
  previous: Target[] = [],
): Target[] {
  const clip = createClipper();
  const all = [...document.querySelectorAll<HTMLElement>("[data-help]")]
    .filter((element) => !!scope?.contains(element) == inside)
    .map((element) => ({ element, ...clip(element) }))
    .filter(({ rect }) => area(rect) >= 4);
  type Candidate = (typeof all)[number];
  const shownBefore = new Set(previous.map(({ element }) => element));
  const fullyClipped = ({ element, rect }: Candidate) =>
    area(rect) >= area(element.getBoundingClientRect()) - 1;
  const distance = ({ rect, view }: Candidate) =>
    Math.hypot(
      (rect.left + rect.right) / 2 - (view.left + view.right) / 2,
      (rect.top + rect.bottom) / 2 - (view.top + view.bottom) / 2,
    );
  const byText = new Map<string, Candidate[]>();
  for (const candidate of all) {
    if (!candidate.element.hasAttribute("data-help-repeat")) continue;
    if (groupOf(candidate.element) != group) continue;
    const text = candidate.element.dataset.help!;
    byText.set(text, [...(byText.get(text) ?? []), candidate]);
  }
  // Fully visible: neither cut off nor covered, e.g. by the sticky header of a table. Only the
  // few best ranked are checked for covering, as that is costly
  const isSeen = (candidate: Candidate) =>
    fullyClipped(candidate) && !isCovered(candidate.element, candidate.rect);
  const repeated = new Map<string, Candidate>();
  for (const [text, candidates] of byText) {
    const before = candidates.find(({ element }) => shownBefore.has(element));
    if (before && isSeen(before)) {
      repeated.set(text, before);
      continue;
    }
    const ranked = candidates
      .filter(fullyClipped)
      .sort((a, b) => distance(a) - distance(b));
    const best =
      ranked.slice(0, COVER_CHECKS).find(isSeen) ??
      ranked[0] ??
      candidates.sort((a, b) => distance(a) - distance(b))[0];
    repeated.set(text, best);
  }
  return all.flatMap(({ element, rect, origin }) => {
    if (groupOf(element) != group) return [];
    if (
      element.hasAttribute("data-help-repeat") &&
      repeated.get(element.dataset.help!)?.element != element
    )
      return [];
    const isGroup =
      element.hasAttribute("data-help-group") &&
      all.some((other) => groupOf(other.element) == element);
    const skew = Number(element.dataset.helpSkew ?? 0);
    // Slanting around the bottom edge moves the top edge sideways
    const shift = -Math.tan((skew * Math.PI) / 180) * (rect.bottom - rect.top);
    return [
      {
        element,
        rect: {
          ...rect,
          left: rect.left + Math.min(shift, 0),
          right: rect.right + Math.max(shift, 0),
        },
        frame: rect,
        origin,
        skew,
        place: element.dataset.helpPlace as Preference | undefined,
        text: element.dataset.help!,
        group: isGroup ? element : undefined,
      },
    ];
  });
}

/** Distance of a point to a line, in pixels. */
function distanceToLine(x: number, y: number, line: Line) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = dx * dx + dy * dy;
  const t =
    length == 0
      ? 0
      : clamp(((x - line.x1) * dx + (y - line.y1) * dy) / length, 0, 1);
  return Math.hypot(x - (line.x1 + t * dx), y - (line.y1 + t * dy));
}

/** Points along an element's side a line may touch, as shares of the side from its middle. */
const TOUCH_OFFSETS = [0, -0.25, 0.25, -0.4, 0.4];
/** Extra cost of touching an element off the middle of its side, per share. */
const OFFSET_COST = 80;

/**
 * The line from a callout to the element's side facing it, if outside of it, touching that
 * side at `offset` (a share of its length) from the middle.
 */
function lineFor(box: Rect, rect: Rect, offset = 0): Line | undefined {
  if (overlap(box, rect) > 0) return undefined;
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  const gapX = Math.max(rect.left - box.right, box.left - rect.right);
  const gapY = Math.max(rect.top - box.bottom, box.top - rect.bottom);
  const boxCenterX = (box.left + box.right) / 2;
  const boxCenterY = (box.top + box.bottom) / 2;
  if (gapX >= gapY) {
    const leftOf = box.right < rect.left;
    return {
      x1: leftOf ? box.right : box.left,
      y1: boxCenterY,
      x2: leftOf ? rect.left : rect.right,
      y2: centerY + offset * (rect.bottom - rect.top),
    };
  }
  const above = box.bottom < rect.top;
  return {
    x1: boxCenterX,
    y1: above ? box.bottom : box.top,
    x2: centerX + offset * (rect.right - rect.left),
    y2: above ? rect.top : rect.bottom,
  };
}

/**
 * Places new callouts so they cover neither the explained elements, other callouts nor each
 * other, and their lines neither run along other lines nor point at them: each one beside its element at the same
 * height if possible, as close as that allows. Large elements like the seating plan cannot be
 * avoided; others may lie on them, and their own callout sits inside.
 * @param all All explained elements, kept free.
 * @param reserved Further areas to keep free, e.g. the closing hint.
 * @param fixed Callouts already placed.
 */
function placeCallouts(
  items: { rect: Rect; place?: Preference; width: number; height: number }[],
  all: { rect: Rect; place?: Preference }[],
  reserved: Rect[],
  fixed: { box: Rect; line?: Line }[],
): { box: Rect; line?: Line }[] {
  const screenArea = innerWidth * innerHeight;
  // Large elements and those explained inside may be covered by other callouts
  const isLarge = ({ rect, place }: { rect: Rect; place?: Preference }) =>
    place == "inside" || area(rect) > screenArea * LARGE_SHARE;
  const obstacles = [
    ...all
      .filter((target) => !isLarge(target))
      .map(({ rect }) => inflate(rect, PADDING)),
    ...reserved.map((rect) => inflate(rect, PADDING)),
  ];
  const placed = fixed.map(({ box }) => box);
  const lines = fixed.flatMap(({ line }) => (line ? [line] : []));
  const results: { box: Rect; line?: Line }[] = [];
  // Small elements first, as large ones have room inside them anyway
  const order = items
    .map((_, index) => index)
    .sort((a, b) => Number(isLarge(items[a])) - Number(isLarge(items[b])));

  for (const index of order) {
    const { rect, place, width, height } = items[index];
    // Beside the element comes first, unless it prefers being above or below
    const rowCost = (side: number) =>
      (side < 0 ? place == "above" : place == "below") ? 0 : ROW_PENALTY;
    const besideCost = place == "above" || place == "below" ? ROW_PENALTY : 0;
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    const boxAt = (x: number, y: number): Rect => {
      const left = clamp(x - width / 2, MARGIN, innerWidth - width - MARGIN);
      const top = clamp(y - height / 2, MARGIN, innerHeight - height - MARGIN);
      return { left, top, right: left + width, bottom: top + height };
    };
    const candidates: { box: Rect; cost: number }[] = [];

    if (isLarge(items[index])) {
      for (
        let y = rect.top + height / 2;
        y <= rect.bottom - height / 2;
        y += INSIDE_STEP
      ) {
        for (
          let x = rect.left + width / 2;
          x <= rect.right - width / 2;
          x += INSIDE_STEP
        ) {
          candidates.push({
            box: boxAt(x, y),
            cost: Math.hypot(x - centerX, y - centerY),
          });
        }
      }
    }
    // Same height on either side first (towards the center of the screen preferred), so the
    // callouts line up with their elements; then above or below, and only then diagonally
    const towardsCenterX = centerX > innerWidth / 2 ? -1 : 1;
    const towardsCenterY = centerY > innerHeight / 2 ? -1 : 1;
    const halfWidth = (rect.right - rect.left + width) / 2;
    const halfHeight = (rect.bottom - rect.top + height) / 2;
    for (const distance of DISTANCES) {
      for (const side of [towardsCenterX, -towardsCenterX]) {
        candidates.push({
          box: boxAt(centerX + side * (halfWidth + distance), centerY),
          cost: besideCost + distance + (side == towardsCenterX ? 0 : 40),
        });
      }
      for (const side of [towardsCenterY, -towardsCenterY]) {
        candidates.push({
          box: boxAt(centerX, centerY + side * (halfHeight + distance)),
          cost: rowCost(side) + distance + (side == towardsCenterY ? 0 : 40),
        });
      }
      for (let step = 0; step < DIRECTIONS; step++) {
        const angle = (step / DIRECTIONS) * 2 * Math.PI;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        candidates.push({
          box: boxAt(
            centerX + dx * (Math.abs(dx) * halfWidth + distance),
            centerY + dy * (Math.abs(dy) * halfHeight + distance),
          ),
          cost: 2 * ROW_PENALTY + distance,
        });
      }
    }

    const collision = (box: Rect) => {
      const padded = inflate(box, PADDING);
      return (
        obstacles.reduce((sum, other) => sum + overlap(padded, other), 0) +
        placed.reduce((sum, other) => sum + overlap(padded, other), 0)
      );
    };
    let best = {
      box: candidates[0].box,
      line: lineFor(candidates[0].box, rect),
    };
    let bestScore = Infinity;
    // Lines neither run along others nor end on one or have one end on them; to avoid that,
    // they may touch their element off the middle of its side
    const conflicts = (line: Line) =>
      lines.filter(
        (other) =>
          linesAlong(line, other) ||
          linesAlong(other, line) ||
          distanceToLine(line.x2, line.y2, other) < LINE_TOLERANCE * 2 ||
          distanceToLine(other.x2, other.y2, line) < LINE_TOLERANCE * 2,
      ).length;
    for (const candidate of candidates) {
      // Any overlap weighs more than every distance and direction
      const base = collision(candidate.box) * 10_000 + candidate.cost;
      if (base >= bestScore) continue;
      for (const offset of TOUCH_OFFSETS) {
        const line = lineFor(candidate.box, rect, offset);
        const score =
          base +
          (line ? conflicts(line) * LINE_PENALTY : 0) +
          Math.abs(offset) * OFFSET_COST;
        if (score < bestScore) {
          best = { box: candidate.box, line };
          bestScore = score;
        }
        // Inside its element a callout has no line to vary
        if (!line) break;
      }
    }
    placed.push(best.box);
    if (best.line) lines.push(best.line);
    results[index] = best;
  }
  return results;
}

/** The innermost element at a point below the help that can scroll, or the page itself. */
function scrollerAt(x: number, y: number, overlay: HTMLElement | null) {
  for (const element of document.elementsFromPoint(x, y)) {
    if (overlay?.contains(element)) continue;
    for (
      let node: Element | null = element;
      node && node != document.documentElement;
      node = node.parentElement
    ) {
      const { overflowX, overflowY } = getComputedStyle(node);
      const scrollsX =
        /auto|scroll/.test(overflowX) && node.scrollWidth > node.clientWidth;
      const scrollsY =
        /auto|scroll/.test(overflowY) && node.scrollHeight > node.clientHeight;
      if (scrollsX || scrollsY) return node;
    }
    break;
  }
  return document.scrollingElement;
}

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
