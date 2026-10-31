import { useRef, type PointerEvent } from "react";

/** Horizontal distance in px from which a touch movement counts as a swipe. */
const MIN_DISTANCE = 60;
/** How many times wider than high a movement has to be, to tell it from vertical movement. */
const MIN_RATIO = 1.5;

/**
 * Detects horizontal swipes by touch. Spread the handlers onto the target element, which needs
 * `touch-action: pan-y` (`touch-pan-y`), as the browser would cancel the gesture otherwise.
 * @param onSwipe Called with `1` for a swipe to the left (next), `-1` to the right (previous).
 */
export function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDownCapture: (event: PointerEvent) => {
      start.current =
        event.pointerType == "mouse"
          ? null
          : { x: event.clientX, y: event.clientY };
    },
    onPointerUpCapture: (event: PointerEvent) => {
      if (!start.current) return;
      const distanceX = event.clientX - start.current.x;
      const distanceY = event.clientY - start.current.y;
      start.current = null;
      if (
        Math.abs(distanceX) >= MIN_DISTANCE &&
        Math.abs(distanceX) >= Math.abs(distanceY) * MIN_RATIO
      ) {
        onSwipe(distanceX < 0 ? 1 : -1);
      }
    },
    onPointerCancelCapture: () => {
      start.current = null;
    },
  };
}
