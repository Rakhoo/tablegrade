import { FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import type { ClassroomMode } from "../../lib/settings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** How a lesson opens on the seating plan and whether grading suggests grades. */
export function LessonSettings() {
  const { startMode, suggestions } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      help="Womit eine Stunde im Sitzplan öffnet und ob beim Bewerten Noten vorgeschlagen werden."
      title="In der Stunde"
    >
      <TextField
        select
        size="small"
        label="Stunde öffnet mit"
        value={startMode}
        className="w-60"
        onChange={(event) =>
          save({ startMode: event.target.value as ClassroomMode })
        }
      >
        <MenuItem value="warn">Ermahnen</MenuItem>
        <MenuItem value="grade">Bewerten</MenuItem>
        <MenuItem value="comment">Kommentieren</MenuItem>
        <MenuItem value="arrange">Anordnen</MenuItem>
      </TextField>
      <FormControlLabel
        label="Vorschläge beim Bewerten anzeigen"
        control={
          <Switch
            checked={suggestions}
            onChange={(event) => save({ suggestions: event.target.checked })}
          />
        }
      />
    </SettingsSection>
  );
}
