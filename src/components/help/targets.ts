import { area, intersect, screenRect, type Rect } from "./geometry";
import type { Preference } from "./placement";

/** Repeated elements checked for being covered, best ranked first. */
const COVER_CHECKS = 12;

export type Target = {
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

/**
 * Creates a function returning the visible part of an element: cut to the screen and to every
 * ancestor that clips its content, like a scrolled table. The ancestors' styles are looked up
 * once per function.
 */
export function createClipper() {
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
      const bounds = parent.getBoundingClientRect();
      view ??= intersect(bounds, screenRect());
      rect = intersect(rect, bounds);
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
export function collectTargets(
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
  /**
   * Fully visible: neither cut off nor covered, e.g. by the sticky header of a table. Only the
   * few best ranked are checked for covering, as that is costly
   */
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

/** The innermost element at a point below the help that can scroll, or the page itself. */
export function scrollerAt(x: number, y: number, overlay: HTMLElement | null) {
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
