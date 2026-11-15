import { FormControlLabel, Switch } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** How much of the week the timetable shows. */
export function TimetableSettings() {
  const { compactTimetable } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      help="Wie viel der Woche der Stundenplan zeigt."
      title="Stundenplan"
      hint="Freistunden zwischen zwei Stunden bleiben sichtbar. Neue Klassen in ausgeblendeten Stunden lassen sich über „Neue Klasse“ anlegen."
    >
      <FormControlLabel
        label="Nur Tage und Stunden mit Unterricht anzeigen"
        control={
          <Switch
            checked={compactTimetable}
            onChange={(event) =>
              save({ compactTimetable: event.target.checked })
            }
          />
        }
      />
    </SettingsSection>
  );
}
