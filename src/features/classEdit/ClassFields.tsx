import {
  Autocomplete,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import type { SchoolClass, SchoolClassInput, SchoolYearPart } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { formatSchoolYear } from "../../lib/formatters";
import { SCHOOL_YEAR_PART_LABELS, WEEKDAY_NAMES } from "../../lib/schoolYear";
import { hasLetters } from "../../lib/settings";

/** The information of a class as edited, without its id. */
export type ClassForm = Omit<SchoolClassInput, "id">;

type LessonTime = Pick<SchoolClass, "day" | "hour" | "double">;

/** First weekday (1 = Monday) other than the given one. */
const firstOtherDay = (day: number) => (day == 1 ? 2 : 1);

type LessonFieldsProps = LessonTime & {
  /** Weekday that cannot be chosen, as it already has the other lesson of the class. */
  excludedDay?: number;
  onChange: (lesson: LessonTime) => void;
};

/** Weekday, lesson and double lesson of one weekly lesson. */
function LessonFields({
  day,
  hour,
  double,
  excludedDay,
  onChange,
}: LessonFieldsProps) {
  const { lessonsPerDay } = useSettings();
  return (
    <>
      <TextField
        select
        label="Wochentag"
        value={day}
        onChange={(event) =>
          onChange({ day: Number(event.target.value), hour, double })
        }
      >
        {WEEKDAY_NAMES.map((weekday, index) =>
          index + 1 == excludedDay ? null : (
            <MenuItem key={weekday} value={index + 1}>
              {weekday}
            </MenuItem>
          ),
        )}
      </TextField>
      <TextField
        select
        label="Schulstunde"
        value={hour}
        onChange={(event) => {
          const newHour = Number(event.target.value);
          onChange({
            day,
            hour: newHour,
            double: double && newHour < lessonsPerDay,
          });
        }}
      >
        {Array.from({ length: lessonsPerDay }, (_, index) => (
          <MenuItem key={index} value={index + 1}>
            {index + 1}. Stunde
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        label="Doppelstunde"
        control={
          <Switch
            checked={double}
            disabled={hour >= lessonsPerDay}
            onChange={(event) =>
              onChange({ day, hour, double: event.target.checked })
            }
          />
        }
      />
    </>
  );
}

type ClassFieldsProps = {
  form: ClassForm;
  onChange: (changes: Partial<ClassForm>) => void;
  /** The school years in use, the only ones a class can belong to. */
  years: number[];
  /** Subjects of all classes, offered while typing. */
  subjects: string[];
};

/** The lessons of a class: school year and half, level, letter, subject and weekly lessons. */
export function ClassFields({
  form,
  onChange: update,
  years,
  subjects,
}: ClassFieldsProps) {
  const settings = useSettings();
  // "Ganzes Jahr" only stays visible for classes that were created with it
  const parts: SchoolYearPart[] =
    form.part == "full" ? ["1", "2", "full"] : ["1", "2"];
  const hasNoLetter = !hasLetters(form.number);
  return (
    <>
      <h3 className="mb-3 text-sm font-semibold tracking-wider text-muted uppercase">
        Unterricht
      </h3>
      <div className="grid grid-cols-2 gap-4 pt-1 portrait:grid-cols-1 landscape:grid-cols-3">
        <TextField
          select
          label="Schuljahr"
          value={form.year}
          onChange={(event) => update({ year: Number(event.target.value) })}
        >
          {years.map((year) => (
            <MenuItem key={year} value={year}>
              {formatSchoolYear(year)}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          exclusive
          color="primary"
          value={form.part}
          onChange={(_, part: SchoolYearPart | null) =>
            part && update({ part })
          }
          className="landscape:col-span-2"
        >
          {parts.map((part) => (
            <ToggleButton key={part} value={part} className="flex-1">
              {SCHOOL_YEAR_PART_LABELS[part]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <TextField
          select
          label="Stufe"
          value={form.number}
          onChange={(event) => update({ number: event.target.value })}
        >
          {settings.levels.map((level) => (
            <MenuItem key={level} value={level}>
              {level}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Buchstabe"
          disabled={hasNoLetter}
          value={hasNoLetter ? "" : (form.letter ?? settings.letters[0])}
          onChange={(event) => update({ letter: event.target.value })}
        >
          {settings.letters.map((letter) => (
            <MenuItem key={letter} value={letter}>
              {letter}
            </MenuItem>
          ))}
        </TextField>
        <Autocomplete
          freeSolo
          options={subjects}
          inputValue={form.subject}
          onInputChange={(_, subject) => update({ subject })}
          renderInput={(params) => (
            <TextField {...params} label="Fach" required />
          )}
        />

        <LessonFields
          day={form.day}
          hour={form.hour}
          double={form.double}
          onChange={(lesson) => {
            // The second lesson has to stay on another weekday
            const isSameDay = lesson.day == form.day2;
            update({
              ...lesson,
              day2: isSameDay ? firstOtherDay(lesson.day) : form.day2,
            });
          }}
        />
        <FormControlLabel
          className="landscape:col-span-3"
          label="Zweite Stunde pro Woche"
          control={
            <Switch
              checked={form.day2 != null}
              onChange={(event) =>
                update(
                  event.target.checked
                    ? {
                        day2: firstOtherDay(form.day),
                        hour2: form.hour,
                        double2: false,
                      }
                    : { day2: null, hour2: null, double2: false },
                )
              }
            />
          }
        />
        {form.day2 != null && form.hour2 != null && (
          <LessonFields
            day={form.day2}
            hour={form.hour2}
            double={form.double2}
            excludedDay={form.day}
            onChange={({ day, hour, double }) =>
              update({ day2: day, hour2: hour, double2: double })
            }
          />
        )}
      </div>
    </>
  );
}
