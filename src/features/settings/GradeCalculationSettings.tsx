import { TextField } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** Limits a typed number to a range, ignoring invalid input. */
const clamp = (text: string, min: number, max: number, fallback: number) => {
  const value = Number(text);
  return Number.isNaN(value) ? fallback : Math.min(Math.max(value, min), max);
};

/** How partial, half year and suggested grades are calculated from the entries. */
export function GradeCalculationSettings() {
  const { examShare, projectShare, recency, minAssessments } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      help="Wie Teil- und Halbjahresnoten aus den Bewertungen berechnet werden."
      title="Notenberechnung"
      hint="Klausuren gegen den Rest, der Rest teilt sich in Projekte und Mündlich. Neuere mündliche Noten zählen mehr."
    >
      <div className="grid grid-cols-4 gap-3 portrait:grid-cols-2">
        <TextField
          type="number"
          size="small"
          label="Anteil Klausuren (%)"
          key={`exam-${examShare}`}
          defaultValue={Math.round(examShare * 100)}
          onBlur={(event) =>
            save({
              examShare:
                clamp(event.target.value, 0, 100, examShare * 100) / 100,
            })
          }
        />
        <TextField
          type="number"
          size="small"
          label="Projekte vom Rest (%)"
          key={`project-${projectShare}`}
          defaultValue={Math.round(projectShare * 100)}
          onBlur={(event) =>
            save({
              projectShare:
                clamp(event.target.value, 0, 100, projectShare * 100) / 100,
            })
          }
        />
        <TextField
          type="number"
          size="small"
          label="Gewicht neueste Note"
          helperText="× älteste Note"
          key={`recency-${recency}`}
          defaultValue={recency}
          slotProps={{ htmlInput: { step: 0.1 } }}
          onBlur={(event) =>
            save({ recency: clamp(event.target.value, 1, 5, recency) })
          }
        />
        <TextField
          type="number"
          size="small"
          label="Mindestanzahl Noten"
          helperText="sonst „n.b.“"
          key={`min-${minAssessments}`}
          defaultValue={minAssessments}
          onBlur={(event) =>
            save({
              minAssessments: Math.round(
                clamp(event.target.value, 1, 20, minAssessments),
              ),
            })
          }
        />
      </div>
    </SettingsSection>
  );
}
