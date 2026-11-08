/** Rectangles and lines on the screen, in pixels, for placing the help callouts. */

/** Lines closer than this, in pixels, run along each other. */
export const LINE_TOLERANCE = 6;

export type Rect = { left: number; top: number; right: number; bottom: number };

export type Line = { x1: number; y1: number; x2: number; y2: number };

export const area = (rect: Rect) =>
  Math.max(rect.right - rect.left, 0) * Math.max(rect.bottom - rect.top, 0);

export const intersect = (a: Rect, b: Rect): Rect => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
});

export const overlap = (a: Rect, b: Rect) => area(intersect(a, b));

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

export const inflate = (rect: Rect, by: number): Rect => ({
  left: rect.left - by,
  top: rect.top - by,
  right: rect.right + by,
  bottom: rect.bottom + by,
});

export const screenRect = (): Rect => ({
  left: 0,
  top: 0,
  right: innerWidth,
  bottom: innerHeight,
});

/** Distance of a point to a line, in pixels. */
export function distanceToLine(x: number, y: number, line: Line) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = dx * dx + dy * dy;
  const t =
    length == 0
      ? 0
      : clamp(((x - line.x1) * dx + (y - line.y1) * dy) / length, 0, 1);
  return Math.hypot(x - (line.x1 + t * dx), y - (line.y1 + t * dy));
}

/** Whether two lines run along each other for a stretch, instead of merely crossing. */
export function linesAlong(a: Line, b: Line) {
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
