import { Chip } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** The levels whose grades are shown as points, chosen from the levels of the school. */
export function PointSettings() {
  const { levels, pointLevels } = useSettings();
  const save = useSaveSettings();

  /** Switches a level between points and marks. */
  const togglePoints = (level: string) =>
    save({
      pointLevels: pointLevels.includes(level)
        ? pointLevels.filter((other) => other != level)
        : [...pointLevels, level],
    });

  return (
    <SettingsSection
      help="Stufen, deren Noten als Punkte erscheinen."
      title="Punkte statt Noten"
      hint="In diesen Stufen erscheinen Bewertungen, Klausur- und Projektnoten und Teilnoten als Punkte (15 bis 0). Gespeichert und gerechnet wird weiter mit Noten."
    >
      <div className="flex flex-wrap gap-1.5">
        {levels.map((level) => {
          const selected = pointLevels.includes(level);
          return (
            <Chip
              key={level}
              label={level}
              color={selected ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              aria-pressed={selected}
              onClick={() => togglePoints(level)}
            />
          );
        })}
      </div>
    </SettingsSection>
  );
}
