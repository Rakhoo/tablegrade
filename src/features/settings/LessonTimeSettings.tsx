import { FormControlLabel, Switch, TextField } from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers";
import { format, isValid, parse } from "date-fns";
import { useSettings } from "../../hooks/useSettings";
import { getLessonTime } from "../../lib/lessons";
import { SettingsSection } from "./SettingsSection";
import { useSaveSettings } from "./useSaveSettings";

/** Earliest and latest selectable start of a lesson, as minutes of the day. */
const EARLIEST = 6 * 60;
const LATEST = 19 * 60 + 55;
/** Lessons start on full 5 minutes. */
const STEP = 5;

/** A time of day ("08:00") as a date of today, for the time picker. */
const toDate = (time: string) => parse(time, "HH:mm", new Date());

/** Whether a picked time is a full 5 minutes between 6:00 and 19:55. */
function isAllowed(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= EARLIEST && minutes <= LATEST && minutes % STEP == 0;
}

/** Whether the timetable shows lesson times, and if so their start times and length. */
export function LessonTimeSettings() {
  const { showLessonTimes } = useSettings();
  const save = useSaveSettings();

  return (
    <SettingsSection
      help="Beginn jeder Stunde und die Länge einer Stunde, für die Uhrzeiten im Stundenplan."
      title="Unterrichtszeiten"
      hint="Erscheinen im Stundenplan neben den Stunden. Stunden ohne Beginn bleiben ohne Uhrzeit."
    >
      <FormControlLabel
        label="Uhrzeiten im Stundenplan anzeigen"
        control={
          <Switch
            checked={showLessonTimes}
            onChange={(event) =>
              save({ showLessonTimes: event.target.checked })
            }
          />
        }
      />
      {showLessonTimes && <LessonTimeFields />}
    </SettingsSection>
  );
}

/** Length of a lesson and the start of each lesson, shown while the times are switched on. */
function LessonTimeFields() {
  const settings = useSettings();
  const { lessonsPerDay, lessonStarts, lessonMinutes } = settings;
  const save = useSaveSettings();

  /** Sets the start time of one lesson; an emptied field removes it. */
  const setStart = (hour: number, value: string) => {
    const starts = Array.from(
      { length: Math.max(lessonStarts.length, hour) },
      (_, index) => lessonStarts[index] ?? "",
    );
    starts[hour - 1] = value;
    save({ lessonStarts: starts });
  };

  return (
    <>
      <TextField
        type="number"
        size="small"
        label="Länge einer Stunde (Minuten)"
        key={`minutes-${lessonMinutes}`}
        defaultValue={lessonMinutes}
        className="w-60"
        slotProps={{ htmlInput: { min: 30, max: 120 } }}
        onBlur={(event) => {
          const value = Math.round(Number(event.target.value));
          if (value >= 30 && value <= 120 && value != lessonMinutes)
            save({ lessonMinutes: value });
        }}
      />
      <div className="grid grid-cols-3 gap-3 portrait:grid-cols-2">
        {Array.from({ length: lessonsPerDay }, (_, index) => {
          const hour = index + 1;
          const time = getLessonTime(settings, hour);
          return (
            <TimePicker
              key={hour}
              label={`${hour}. Stunde`}
              ampm={false}
              minutesStep={STEP}
              timeSteps={{ minutes: STEP }}
              skipDisabled
              minTime={toDate("06:00")}
              maxTime={toDate("19:55")}
              value={lessonStarts[index] ? toDate(lessonStarts[index]) : null}
              // Half typed or not allowed times are not saved, a cleared field removes it
              onChange={(value) => {
                if (value == null) setStart(hour, "");
                else if (isValid(value) && isAllowed(value))
                  setStart(hour, format(value, "HH:mm"));
              }}
              slotProps={{
                textField: {
                  size: "small",
                  helperText: time ? `bis ${time.end}` : " ",
                },
                field: { clearable: true },
              }}
            />
          );
        })}
      </div>
    </>
  );
}
