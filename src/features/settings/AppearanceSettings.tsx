import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useSettings } from "../../hooks/useSettings";
import {
  getThemeTokens,
  THEMES,
  type ColorMode,
  type ThemeId,
} from "../../lib/themes";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

const COLOR_MODES: { mode: ColorMode; label: string }[] = [
  { mode: "light", label: "Hell" },
  { mode: "dark", label: "Dunkel" },
  { mode: "system", label: "Wie Gerät" },
];

/** Color theme and light or dark mode. */
export function AppearanceSettings() {
  const { theme, colorMode } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection title="Darstellung">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const tokens = getThemeTokens(id, false);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={id == theme}
              onClick={() => save({ theme: id })}
              className={
                "flex items-center gap-2 rounded-2xl border border-line px-3 py-2 font-medium " +
                (id == theme ? "ring-2 ring-brand-400" : "")
              }
            >
              <span className="flex">
                {["brand-200", "brand-500", "blush-400"].map((token) => (
                  <span
                    key={token}
                    className="-ml-1 h-5 w-5 rounded-full first:ml-0"
                    style={{ background: tokens[token] }}
                  />
                ))}
              </span>
              {THEMES[id].label}
            </button>
          );
        })}
      </div>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={colorMode}
        onChange={(_, value: ColorMode | null) =>
          value && save({ colorMode: value })
        }
        className="self-start rounded-full bg-brand-50 p-0.5"
      >
        {COLOR_MODES.map(({ mode, label }) => (
          <ToggleButton key={mode} value={mode} className="toggle-pill">
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </SettingsSection>
  );
}
