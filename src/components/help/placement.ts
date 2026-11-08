import {
  area,
  clamp,
  distanceToLine,
  inflate,
  LINE_TOLERANCE,
  linesAlong,
  overlap,
  type Line,
  type Rect,
} from "./geometry";

/** Space kept free around elements and callouts. */
export const PADDING = 6;

/** Distance of the callouts to the screen edge. */
const MARGIN = 8;

/** Elements covering more of the screen get their callout inside, e.g. the seating plan. */
export const LARGE_SHARE = 0.12;

/** Gaps between an element and its callout that are tried, closest first. */
const DISTANCES = [24, 40, 64, 96, 136, 184, 240, 310, 400];

/** Directions tried around an element. */
const DIRECTIONS = 16;

/** Extra cost of a callout above or below its element instead of beside it, in pixels. */
const ROW_PENALTY = 600;

/** Extra cost of a line running along another one; crossing is fine. */
const LINE_PENALTY = 3000;

/** Step of the positions tried inside a large element. */
const INSIDE_STEP = 24;

/** Points along an element's side a line may touch, as shares of the side from its middle. */
const TOUCH_OFFSETS = [0, -0.25, 0.25, -0.4, 0.4];

/** Extra cost of touching an element off the middle of its side, per share. */
const OFFSET_COST = 80;

/** Where a callout should go (`data-help-place`): inside its element, centered, or above or below it. */
export type Preference = "inside" | "above" | "below";

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
export function placeCallouts(
  items: { rect: Rect; place?: Preference; width: number; height: number }[],
  all: { rect: Rect; place?: Preference }[],
  reserved: Rect[],
  fixed: { box: Rect; line?: Line }[],
): { box: Rect; line?: Line }[] {
  const screenArea = innerWidth * innerHeight;
  /** Large elements and those explained inside may be covered by other callouts */
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
    /** Beside the element comes first, unless it prefers being above or below */
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
    /**
     * Lines neither run along others nor end on one or have one end on them; to avoid that,
     * they may touch their element off the middle of its side
     */
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
