import { WARNING_LEVELS } from "../../lib/warnings";

/** Hint of the warning mode: the levels a tap cycles through. */
export function WarningLevels() {
  return (
    <div className="flex items-center gap-2">
      Antippen:
      {WARNING_LEVELS.map((level) => (
        <span
          key={level?.label ?? "none"}
          className="rounded-full px-2.5 py-1 font-semibold"
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
