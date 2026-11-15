import { MenuItem, Switch, TextField } from "@mui/material";
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

/** The symbol of each oral grade, which grades the grading bar offers, and the absent symbol. */
export function GradeSymbolSettings() {
  const settings = useSettings();
  const save = useSaveSettings();
  const { gradeSymbols, absentSymbol } = settings;
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
      help="Symbol jeder mündlichen Note, welche Noten die Bewertungsleiste anbietet, und das Symbol für abwesend."
      title="Bewertungssymbole"
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
        label="Symbol für abwesend"
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
    </SettingsSection>
  );
}
