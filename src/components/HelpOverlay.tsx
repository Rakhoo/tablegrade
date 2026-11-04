import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Space kept free around elements and callouts. */
const PADDING = 6;
/** Distance of the callouts to the screen edge. */
const MARGIN = 8;
/** Elements covering more of the screen get their callout inside, e.g. the seating plan. */
const LARGE_SHARE = 0.12;
/** Gaps between an element and its callout that are tried, closest first. */
const DISTANCES = [24, 40, 64, 96, 136, 184, 240, 310, 400];
/** Directions tried around an element. */
const DIRECTIONS = 16;
/** Extra cost of a callout above or below its element instead of beside it, in pixels. */
const ROW_PENALTY = 600;
/** Step of the positions tried inside a large element. */
const INSIDE_STEP = 24;

type Rect = { left: number; top: number; right: number; bottom: number };
type Target = { rect: Rect; text: string };
type Line = { x1: number; y1: number; x2: number; y2: number };
type Placement = { left: number; top: number; line?: Line };

const area = (rect: Rect) =>
  Math.max(rect.right - rect.left, 0) * Math.max(rect.bottom - rect.top, 0);

const overlap = (a: Rect, b: Rect) =>
  area({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const inflate = (rect: Rect, by: number): Rect => ({
  left: rect.left - by,
  top: rect.top - by,
  right: rect.right + by,
  bottom: rect.bottom + by,
});

/**
 * All visible elements with a `data-help` text, cut to the screen: those inside `scope`, or with
 * `inside` false all others.
 */
function collectTargets(scope: HTMLElement | null, inside: boolean): Target[] {
  const screen = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  return [...document.querySelectorAll<HTMLElement>("[data-help]")].flatMap(
    (element) => {
      if (!!scope?.contains(element) != inside) return [];
      const box = element.getBoundingClientRect();
      const rect = {
        left: Math.max(box.left, 0),
        top: Math.max(box.top, 0),
        right: Math.min(box.right, screen.right),
        bottom: Math.min(box.bottom, screen.bottom),
      };
      if (area(rect) < 4) return [];
      return [{ rect, text: element.dataset.help! }];
    },
  );
}

/**
 * Places the callouts so they cover neither the explained elements nor each other: each one
 * beside its element at the same height if possible, as close as that allows, connected to it
 * by a line. Large elements like the
 * seating plan cannot be avoided; others may lie on them, and their own callout sits inside.
 * @param reserved Further areas to keep free, e.g. the closing hint.
 */
function placeCallouts(
  targets: Target[],
  sizes: { width: number; height: number }[],
  reserved: Rect[],
): Placement[] {
  const screenArea = innerWidth * innerHeight;
  const isLarge = (rect: Rect) => area(rect) > screenArea * LARGE_SHARE;
  const obstacles = [
    ...targets
      .filter(({ rect }) => !isLarge(rect))
      .map(({ rect }) => inflate(rect, PADDING)),
    ...reserved.map((rect) => inflate(rect, PADDING)),
  ];
  const placed: Rect[] = [];
  const placements: Placement[] = [];
  // Small elements first, as large ones have room inside them anyway
  const order = targets
    .map((_, index) => index)
    .sort(
      (a, b) =>
        Number(isLarge(targets[a].rect)) - Number(isLarge(targets[b].rect)),
    );

  for (const index of order) {
    const { rect } = targets[index];
    const { width, height } = sizes[index];
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    const boxAt = (x: number, y: number): Rect => {
      const left = clamp(x - width / 2, MARGIN, innerWidth - width - MARGIN);
      const top = clamp(y - height / 2, MARGIN, innerHeight - height - MARGIN);
      return { left, top, right: left + width, bottom: top + height };
    };
    const candidates: { box: Rect; cost: number }[] = [];

    if (isLarge(rect)) {
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
          cost: distance + (side == towardsCenterX ? 0 : 40),
        });
      }
      for (const side of [towardsCenterY, -towardsCenterY]) {
        candidates.push({
          box: boxAt(centerX, centerY + side * (halfHeight + distance)),
          cost: ROW_PENALTY + distance + (side == towardsCenterY ? 0 : 40),
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
    let best = candidates[0];
    let bestScore = Infinity;
    for (const candidate of candidates) {
      // Any overlap weighs more than every distance and direction
      const score = collision(candidate.box) * 10_000 + candidate.cost;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    const { box } = best;
    placed.push(box);

    // Points at the middle of the element's side facing the callout, from the middle of the
    // callout's side facing the element
    const gapX = Math.max(rect.left - box.right, box.left - rect.right);
    const gapY = Math.max(rect.top - box.bottom, box.top - rect.bottom);
    const beside = gapX >= gapY;
    const boxCenterX = (box.left + box.right) / 2;
    const boxCenterY = (box.top + box.bottom) / 2;
    const from = beside
      ? { x: box.right < rect.left ? box.right : box.left, y: boxCenterY }
      : { x: boxCenterX, y: box.bottom < rect.top ? box.bottom : box.top };
    const to = beside
      ? { x: box.right < rect.left ? rect.left : rect.right, y: centerY }
      : { x: centerX, y: box.bottom < rect.top ? rect.top : rect.bottom };
    placements[index] = {
      left: box.left,
      top: box.top,
      // A callout inside its element needs no line
      line:
        overlap(box, rect) > 0
          ? undefined
          : { x1: from.x, y1: from.y, x2: to.x, y2: to.y },
    };
  }
  return placements;
}

/**
 * Explains what is currently on the screen: every element with a `data-help` text gets a
 * callout, connected to it by a line. A tap anywhere closes the explanations.
 */
type HelpOverlayProps = {
  /** The part of the page to explain, see `inside`. */
  scope: HTMLElement | null;
  /** Explains the elements inside `scope`, otherwise all others. */
  inside: boolean;
  onClose: () => void;
};

export function HelpOverlay({ scope, inside, onClose }: HelpOverlayProps) {
  const [targets] = useState(() => collectTargets(scope, inside));
  const callouts = useRef<(HTMLDivElement | null)[]>([]);
  const closingHint = useRef<HTMLDivElement>(null);
  const [placements, setPlacements] = useState<Placement[] | null>(null);

  // First rendered invisibly, so the callouts can be measured before they are placed
  useLayoutEffect(() => {
    const sizes = callouts.current.map((callout) => ({
      width: callout?.offsetWidth ?? 0,
      height: callout?.offsetHeight ?? 0,
    }));
    const hint = closingHint.current?.getBoundingClientRect();
    setPlacements(placeCallouts(targets, sizes, hint ? [hint] : []));
  }, [targets]);

  useEffect(() => {
    window.addEventListener("resize", onClose);
    return () => window.removeEventListener("resize", onClose);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] select-none"
      onClick={onClose}
      role="dialog"
      aria-label="Hilfe"
    >
      <div className="absolute inset-0 bg-black/45" />
      {targets.map(({ rect }, index) => (
        <div
          key={`frame-${index}`}
          className="absolute rounded-xl ring-2 ring-white/90"
          style={{
            left: rect.left - 3,
            top: rect.top - 3,
            width: rect.right - rect.left + 6,
            height: rect.bottom - rect.top + 6,
          }}
        />
      ))}
      {placements && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {placements.map(
            ({ line }, index) =>
              line && (
                <g key={index} className="text-white">
                  <line
                    {...line}
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <circle cx={line.x2} cy={line.y2} r={4} fill="currentColor" />
                </g>
              ),
          )}
        </svg>
      )}
      {targets.map(({ text }, index) => {
        const placement = placements?.[index];
        return (
          <div
            key={`callout-${index}`}
            ref={(element) => {
              callouts.current[index] = element;
            }}
            className="absolute w-max max-w-56 rounded-xl bg-surface px-3 py-2 text-sm leading-snug text-ink shadow-[0_4px_18px_rgb(0_0_0/0.45)] ring-1 ring-black/15"
            style={
              placement
                ? { left: placement.left, top: placement.top }
                : { left: 0, top: 0, visibility: "hidden" }
            }
          >
            {text}
          </div>
        );
      })}
      <div
        ref={closingHint}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-card"
      >
        Zum Schließen irgendwo tippen
      </div>
    </div>,
    document.body,
  );
}
