import { FormControlLabel, Switch } from "@mui/material";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { SettingsSection } from "./SettingsSection";

/** How grading is operated on this device: all tools open or one tool button. */
export function ControlSettings() {
  const [gradeButton, setGradeButton] = useDisplayOption("gradeButton");

  return (
    <SettingsSection
      help="Bedienung von Sitzplan und Übersicht auf diesem Gerät."
      title="Bedienung"
      hint="Gilt nur für dieses Gerät. Auf dem Smartphone ist das Werkzeug immer ein einzelner Knopf."
    >
      <FormControlLabel
        label="Bewerten mit einem Werkzeug-Knopf (halten, gleiten, loslassen)"
        control={
          <Switch
            checked={gradeButton}
            onChange={(event) => setGradeButton(event.target.checked)}
          />
        }
      />
    </SettingsSection>
  );
}
