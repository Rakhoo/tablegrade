import { NIB_CHECK, NIB_OUTLINE } from "../icons";

/** Loading indicator: the nib of the app icon, its check mark drawing itself over and over. */
export function LoadingFeather({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Wird geladen"
    >
      <path d={NIB_OUTLINE} />
      <path d={NIB_CHECK} pathLength={1} className="draw-check" />
    </svg>
  );
}
