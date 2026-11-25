import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { area, type Rect } from "./geometry";
import { collectTargets, createClipper, type Target } from "./targets";

/** Room in pixels between the framed element and its explanation. */
const GAP = 12;

/**
 * All explanations of the page in reading order: each card is followed by the elements inside
 * it, as small screens have no room to explain them all at once.
 */
function collectSteps(group: HTMLElement | null = null): Target[] {
  const targets = collectTargets(null, false, group).sort(
    (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left,
  );
  return targets.flatMap((target) =>
    target.group ? [target, ...collectSteps(target.group)] : [target],
  );
}

/** The visible part of an element, after scrolling it into view. */
function measure(element: HTMLElement): Rect {
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
  return createClipper()(element).rect;
}

type HelpStepsProps = {
  onClose: () => void;
};

/**
 * Help of small screens: explains the page one element after the other. The element is framed
 * on a darkened page, its explanation sits above or below it, and "Weiter" goes on.
 */
export function HelpSteps({ onClose }: HelpStepsProps) {
  const [steps] = useState(collectSteps);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index];

  // Scrolling and measuring need the rendered page
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setRect(step ? measure(step.element) : null);
  }, [step]);

  const last = index == steps.length - 1;
  // The explanation goes where more room is left, below the element if equal
  const below = !rect || rect.top < innerHeight - rect.bottom;
  const visible = rect && area(rect) > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] touch-none select-none"
      data-help-overlay
      role="dialog"
      aria-label="Hilfe"
    >
      {visible ? (
        // The frame darkens everything around the element with its shadow
        <div
          className="absolute rounded-xl ring-2 ring-blush-400 transition-all duration-200"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.right - rect.left + 8,
            height: rect.bottom - rect.top + 8,
            boxShadow: "0 0 0 100vmax rgb(0 0 0 / 0.5)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div
        className="absolute inset-x-3 rounded-2xl bg-surface p-4 text-sm leading-snug text-ink shadow-card"
        style={
          !visible
            ? { top: "40%" }
            : below
              ? { top: Math.min(rect.bottom + GAP, innerHeight - 160) }
              : {
                  bottom: Math.min(
                    innerHeight - rect.top + GAP,
                    innerHeight - 160,
                  ),
                }
        }
      >
        <p>{step?.text ?? "Auf dieser Seite gibt es nichts zu erklären."}</p>
        <div className="mt-3 flex items-center justify-between gap-2 font-semibold">
          <button
            type="button"
            className="px-2 py-1 text-brand-600 disabled:opacity-40"
            disabled={index == 0}
            onClick={() => setIndex(index - 1)}
          >
            Zurück
          </button>
          <span className="text-muted tabular-nums">
            {steps.length > 0 ? `${index + 1} / ${steps.length}` : ""}
          </span>
          <button
            type="button"
            className="rounded-full bg-brand-600 px-4 py-1.5 text-white"
            onClick={() => (last || !step ? onClose() : setIndex(index + 1))}
          >
            {last || !step ? "Fertig" : "Weiter"}
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Hilfe schließen"
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-xl leading-none text-ink shadow-card"
        onClick={onClose}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}
