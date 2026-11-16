import { FormControlLabel, Switch } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** How dense the overview tables are. */
export function OverviewTableSettings() {
  const { compactTable } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      help="Wie dicht die Übersichtstabellen sind."
      title="Übersichtstabelle"
      hint="Kompakt passen mehr Stunden und Schüler auf einen Blick; Felder und Symbole werden dafür kleiner."
    >
      <FormControlLabel
        label="Kompakte Tabelle"
        control={
          <Switch
            checked={compactTable}
            onChange={(event) => save({ compactTable: event.target.checked })}
          />
        }
      />
    </SettingsSection>
  );
}
