import { RAVEN_SHAPES, RAVEN_VIEW_BOX } from "./ravenShapes";

/** The mascot, a raven on a fountain pen nib, as a silhouette in the current text color. */
export function Raven({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={RAVEN_VIEW_BOX}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {RAVEN_SHAPES.map(({ d, opacity }) => (
        <path key={d.slice(0, 24)} d={d} fillOpacity={opacity} />
      ))}
    </svg>
  );
}
