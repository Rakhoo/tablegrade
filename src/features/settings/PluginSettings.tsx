import { FormControlLabel, Switch } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** Optional features for single schools, off by default. */
export function PluginSettings() {
  const { letHelper } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      title="Plugins"
      hint="Zusatzfunktionen für einzelne Schulen. Der LET-Helfer ergänzt den Export der Übersicht um eine Datei für den Elternsprechtag-Helfer."
      help="Zusatzfunktionen für einzelne Schulen, standardmäßig aus."
    >
      <FormControlLabel
        label="LET-Helfer der TMG Ahlen"
        control={
          <Switch
            checked={letHelper}
            onChange={(event) => save({ letHelper: event.target.checked })}
          />
        }
      />
    </SettingsSection>
  );
}
