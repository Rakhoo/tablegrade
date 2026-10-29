import { useRef, type MouseEvent, type PointerEvent } from "react";

/** Pointer movement in px after which a press no longer counts as long press. */
const MOVE_TOLERANCE = 10;

/**
 * Calls `onLongPress` when the element is pressed and held for `delay` ms.
 * Spread the returned handlers onto the target element.
 */
export function useLongPress(onLongPress: () => void, delay = 600) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (event: PointerEvent) => {
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        start.current = null;
        onLongPress();
      }, delay);
    },
    onPointerMove: (event: PointerEvent) => {
      if (
        start.current &&
        Math.hypot(
          event.clientX - start.current.x,
          event.clientY - start.current.y,
        ) > MOVE_TOLERANCE
      )
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Suppress the iOS context menu and text selection triggered by long presses
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
  };
}
