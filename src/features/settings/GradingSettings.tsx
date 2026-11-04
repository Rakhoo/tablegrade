import { FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import { AbsentBadge, GradeBadge } from "../../components/GradeBadge";
import { useSettings } from "../../hooks/useSettings";
import {
  ABSENT_SYMBOLS,
  getSymbolsForGrade,
  GRADE_SYMBOLS,
  type AbsentSymbol,
  type GradeSymbol,
} from "../../lib/gradeSymbols";
import {
  ABSENT_COLOR,
  formatMark,
  getGradeColor,
  GRADE_VALUES,
} from "../../lib/grades";
import { getVisibleGrades } from "../../lib/settings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** Limits a typed number to a range, ignoring invalid input. */
const clamp = (text: string, min: number, max: number, fallback: number) => {
  const value = Number(text);
  return Number.isNaN(value) ? fallback : Math.min(Math.max(value, min), max);
};

/** Symbols of the oral grades, which of them are offered, and the calculation of grades. */
export function GradingSettings() {
  const settings = useSettings();
  const save = useSaveSettings();
  const {
    gradeSymbols,
    absentSymbol,
    suggestions,
    examShare,
    projectShare,
    recency,
    minAssessments,
  } = settings;
  const visibleCount = getVisibleGrades(settings).length;

  const updateGrade = (
    value: number,
    changes: Partial<(typeof gradeSymbols)[number]>,
  ) =>
    save({
      gradeSymbols: {
        ...gradeSymbols,
        [value]: { ...gradeSymbols[value], ...changes },
      },
    });

  return (
    <SettingsSection
      help="Bewertungssymbole, angebotene Noten und wie Noten aus den Bewertungen berechnet werden."
      title="Benotung"
      hint="Ausgeblendete Noten fehlen in der Bewertungsleiste, bleiben aber bei vorhandenen Einträgen sichtbar."
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 portrait:grid-cols-1">
        {GRADE_VALUES.map((value) => {
          const { symbol, visible } = gradeSymbols[value];
          return (
            <div key={value} className="flex items-center gap-2">
              <span className="w-7 font-semibold">{formatMark(value)}</span>
              <TextField
                select
                size="small"
                fullWidth
                aria-label={`Symbol für ${formatMark(value)}`}
                value={symbol}
                onChange={(event) =>
                  updateGrade(value, {
                    symbol: event.target.value as GradeSymbol,
                  })
                }
              >
                {getSymbolsForGrade(value).map((option) => (
                  <MenuItem key={option} value={option}>
                    <span className="flex items-center gap-2">
                      <GradeBadge
                        symbol={option}
                        value={value}
                        color={getGradeColor(value)}
                        size={24}
                      />
                      {GRADE_SYMBOLS[option].label}
                    </span>
                  </MenuItem>
                ))}
              </TextField>
              <Switch
                aria-label={`${formatMark(value)} anzeigen`}
                checked={visible}
                // At least one grade has to stay available
                disabled={visible && visibleCount == 1}
                onChange={(event) =>
                  updateGrade(value, { visible: event.target.checked })
                }
              />
            </div>
          );
        })}
      </div>

      <TextField
        select
        size="small"
        label="Symbol für entschuldigt"
        value={absentSymbol}
        onChange={(event) =>
          save({ absentSymbol: event.target.value as AbsentSymbol })
        }
      >
        {(Object.keys(ABSENT_SYMBOLS) as AbsentSymbol[]).map((option) => (
          <MenuItem key={option} value={option}>
            <span className="flex items-center gap-2">
              <AbsentBadge symbol={option} color={ABSENT_COLOR} size={24} />
              {ABSENT_SYMBOLS[option]}
            </span>
          </MenuItem>
        ))}
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
