import { MenuItem, TextField } from "@mui/material";
import type { SchoolClass } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

const parseList = (text: string) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

type SchoolSettingsProps = { schoolClasses: SchoolClass[] };

/** Levels, letters and lessons per day of the school. */
export function SchoolSettings({ schoolClasses }: SchoolSettingsProps) {
  const { levels, letters, lessonsPerDay } = useSettings();
  const save = useSaveSettings();

  // Values used by classes cannot be removed, these classes would lose them
  const usedLevels = schoolClasses.map((cls) => cls.number);
  const usedLetters = schoolClasses.flatMap((cls) =>
    cls.letter ? [cls.letter] : [],
  );
  const lastUsedLesson = Math.max(
    ...schoolClasses.map((cls) => Math.max(cls.hour + (cls.double ? 1 : 0), 4)),
    ...schoolClasses.map((cls) => (cls.hour2 ?? 0) + (cls.double2 ? 1 : 0)),
    4,
  );

  return (
    <SettingsSection
      help="Stufen, Klassenbuchstaben und Stunden pro Tag."
      title="Stufen und Stunden"
      hint="Stufen ohne Zahl am Anfang (z. B. EF) haben keinen Buchstaben. Von Klassen genutzte Werte bleiben erhalten."
    >
      <div className="grid grid-cols-2 gap-3 portrait:grid-cols-1">
        <TextField
          size="small"
          label="Stufen (mit Komma getrennt)"
          key={levels.join()}
          defaultValue={levels.join(", ")}
          onBlur={(event) =>
            save({
              levels: [
                ...new Set([...parseList(event.target.value), ...usedLevels]),
              ],
            })
          }
        />
        <TextField
          size="small"
          label="Buchstaben (mit Komma getrennt)"
          key={letters.join()}
          defaultValue={letters.join(", ")}
          onBlur={(event) =>
            save({
              letters: [
                ...new Set([...parseList(event.target.value), ...usedLetters]),
              ],
            })
          }
        />
        <TextField
          select
          size="small"
          label="Schulstunden pro Tag"
          value={lessonsPerDay}
          onChange={(event) =>
            save({ lessonsPerDay: Number(event.target.value) })
          }
        >
          {Array.from(
            { length: 13 - lastUsedLesson },
            (_, index) => lastUsedLesson + index,
          ).map((count) => (
            <MenuItem key={count} value={count}>
              {count}
            </MenuItem>
          ))}
        </TextField>
      </div>
    </SettingsSection>
  );
}
