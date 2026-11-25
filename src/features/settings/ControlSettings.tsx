import { FormControlLabel, Switch } from "@mui/material";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { SettingsSection } from "./SettingsSection";

/**
 * How grading and the overview are operated on this device: all tools open or one tool button,
 * and what a tap on a name in the overview opens first.
 */
export function ControlSettings() {
  const [gradeButton, setGradeButton] = useDisplayOption("gradeButton");
  const [studentCard, setStudentCard] = useDisplayOption("studentCard");

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
      <FormControlLabel
        label="Übersicht: Tipp auf einen Namen öffnet zuerst die Karte (sonst nur die Einträge in der Tabelle)"
        control={
          <Switch
            checked={studentCard}
            onChange={(event) => setStudentCard(event.target.checked)}
          />
        }
      />
    </SettingsSection>
  );
}
