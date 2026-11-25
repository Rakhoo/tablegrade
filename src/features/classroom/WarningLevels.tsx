import { WARNING_LEVELS } from "../../lib/warnings";

/** Hint of the warning mode: the levels a tap cycles through. */
export function WarningLevels() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 compact:gap-1">
      <span className="compact:hidden">Antippen:</span>
      {WARNING_LEVELS.map((level) => (
        <span
          key={level?.label ?? "none"}
          className="rounded-full px-2.5 py-1 font-semibold compact:px-2 compact:py-0.5"
          style={{
            background: level?.background ?? "var(--color-surface)",
            color: level ? "var(--color-ink)" : "var(--color-muted)",
          }}
        >
          {level?.label ?? "Normal"}
        </span>
      ))}
    </div>
  );
}
