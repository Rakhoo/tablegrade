import { FormControlLabel, Switch } from "@mui/material";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { SettingsSection } from "./SettingsSection";

/** How the seating plan is operated on this device: side of the side bar and the tool button. */
export function ControlSettings() {
  const [railLeft, setRailLeft] = useDisplayOption("railLeft");
  const [gradeButton, setGradeButton] = useDisplayOption("gradeButton");

  return (
    <SettingsSection
      help="Bedienung von Sitzplan und Übersicht auf diesem Gerät."
      title="Bedienung"
      hint="Gilt nur für dieses Gerät. Auf dem Smartphone ist das Werkzeug immer ein einzelner Knopf."
    >
      <FormControlLabel
        label="Seitenleiste im Querformat links (für die linke Hand)"
        control={
          <Switch
            checked={railLeft}
            onChange={(event) => setRailLeft(event.target.checked)}
          />
        }
      />
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
