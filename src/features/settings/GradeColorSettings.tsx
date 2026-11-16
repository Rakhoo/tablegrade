import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import {
  getGradeColor,
  WHOLE_GRADES,
  type GradePalette,
} from "../../lib/grades";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** The selectable color scales of the grades. */
const PALETTES: { palette: GradePalette; label: string }[] = [
  { palette: "standard", label: "Grün bis Rot" },
  { palette: "colorblind", label: "Blau bis Orange" },
];

/** Color scale of the grades, with a colorblind friendly one. */
export function GradeColorSettings() {
  const { gradePalette } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      help="Farbskala der Noten in der ganzen App und im PDF-Export."
      title="Notenfarben"
      hint="„Blau bis Orange“ ist auch bei Rot-Grün-Sehschwäche gut zu unterscheiden. Gilt in der ganzen App und im PDF-Export."
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={gradePalette}
        onChange={(_, value: GradePalette | null) =>
          value && save({ gradePalette: value })
        }
        className="self-start rounded-full bg-brand-50 p-0.5"
      >
        {PALETTES.map(({ palette, label }) => (
          <ToggleButton key={palette} value={palette} className="toggle-pill">
            <span className="mr-2 flex">
              {WHOLE_GRADES.map((grade) => (
                <span
                  key={grade}
                  className="h-3 w-3 first:rounded-l-full last:rounded-r-full"
                  style={{ background: getGradeColor(grade, palette) }}
                />
              ))}
            </span>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </SettingsSection>
  );
}
