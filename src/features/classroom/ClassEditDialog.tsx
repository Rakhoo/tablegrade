import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useRef, useState } from "react";
import {
  getClassStudents,
  type Holiday,
  type RosterEntry,
  type SchoolClass,
  type SchoolClassInput,
  type SchoolYearPart,
  type SeatedStudent,
} from "../../db";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TrashIcon } from "../../components/icons";
import { formatClassName, formatSchoolYear } from "../../lib/formatters";
import {
  CLASS_LETTERS,
  CLASS_LEVELS,
  doSchoolClassesCollide,
  FIRST_SCHOOL_YEAR,
  getSchoolYear,
  getSchoolYearPart,
  LESSONS_PER_DAY,
  SCHOOL_YEAR_PART_LABELS,
  UPPER_SCHOOL_LEVELS,
  WEEKDAY_NAMES,
} from "../../lib/schoolYear";

type ClassForm = Omit<SchoolClassInput, "id">;
/** Roster row with a stable React key, also for students not saved yet. */
type RosterRow = RosterEntry & { key: string };

type ClassEditDialogProps = {
  /** The edited class, `undefined` when creating a new one. */
  cls?: SchoolClass;
  students: SeatedStudent[];
  allClasses: SchoolClass[];
  subjects: string[];
  holidays: Holiday[];
  /** Preset weekday and lesson for new classes (from the timetable cell). */
  preset: { day?: number; hour?: number; date: Date };
  onSave: (form: ClassForm, roster: RosterEntry[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
};

/** Initial form values for a new class in the school year half of the preset date. */
function emptyForm(
  holidays: Holiday[],
  preset: ClassEditDialogProps["preset"],
): ClassForm {
  return {
    subject: "",
    number: "5",
    letter: CLASS_LETTERS[0],
    year: getSchoolYear(preset.date, holidays),
    part: getSchoolYearPart(preset.date, holidays),
    day: preset.day ?? 1,
    hour: preset.hour ?? 1,
    double: false,
  };
}

/**
 * Edit popup for all class information and the student list.
 * Mount it only while open, its state is initialized from the props once.
 */
export function ClassEditDialog({
  cls,
  students,
  allClasses,
  subjects,
  holidays,
  preset,
  onSave,
  onDelete,
  onCancel,
}: ClassEditDialogProps) {
  const [form, setForm] = useState<ClassForm>(
    () => cls ?? emptyForm(holidays, preset),
  );
  const [roster, setRoster] = useState<RosterRow[]>(() =>
    students.map((s) => ({ key: `s${s.id}`, id: s.id, name: s.name })),
  );
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RosterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(0);
  const [focusKey, setFocusKey] = useState<string>();

  const update = (changes: Partial<ClassForm>) =>
    setForm((prev) => ({ ...prev, ...changes }));
  const isUpperSchool = UPPER_SCHOOL_LEVELS.includes(form.number);
  const thisYear = getSchoolYear(new Date(), holidays);
  const years = [thisYear - 1, thisYear, thisYear + 1].filter(
    (year) => year >= FIRST_SCHOOL_YEAR,
  );

  const draft = { ...form, id: cls?.id ?? -1 };
  const collisions = allClasses.filter(
    (other) =>
      other.id != cls?.id && doSchoolClassesCollide(draft, other, holidays),
  );
  const otherClasses = allClasses.filter((other) => other.id != cls?.id);

  /** Appends names to the roster, skipping students that are already part of it. */
  const addStudents = (entries: RosterEntry[]) => {
    setRoster((prev) => [
      ...prev,
      ...entries
        .filter((entry) => !entry.id || !prev.some((row) => row.id == entry.id))
        .map((entry) => ({ ...entry, key: `n${nextKey.current++}` })),
    ]);
  };

  /** Splits the pasted list into one roster entry per non-empty line. */
  const parsePaste = (text: string): RosterEntry[] =>
    text
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

  const removeRow = (row: RosterRow) =>
    setRoster((prev) => prev.filter((r) => r.key != row.key));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          subject: form.subject.trim(),
          letter: isUpperSchool ? null : (form.letter ?? CLASS_LETTERS[0]),
        },
        // A pasted list that was not applied yet is saved as well
        [...roster, ...parsePaste(pasteText ?? "")]
          .map(({ id, name }) => ({ id, name: name.trim() }))
          .filter((entry) => entry.name),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>{cls ? "Klasseninformationen" : "Neue Klasse"}</DialogTitle>
      <DialogContent>
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
            {(Object.keys(SCHOOL_YEAR_PART_LABELS) as SchoolYearPart[]).map(
              (part) => (
                <ToggleButton key={part} value={part} className="flex-1">
                  {SCHOOL_YEAR_PART_LABELS[part]}
                </ToggleButton>
              ),
            )}
          </ToggleButtonGroup>

          <TextField
            select
            label="Stufe"
            value={form.number}
            onChange={(event) => update({ number: event.target.value })}
          >
            {CLASS_LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                {level}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Buchstabe"
            disabled={isUpperSchool}
            value={isUpperSchool ? "" : (form.letter ?? CLASS_LETTERS[0])}
            onChange={(event) => update({ letter: event.target.value })}
          >
            {CLASS_LETTERS.map((letter) => (
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

          <TextField
            select
            label="Wochentag"
            value={form.day}
            onChange={(event) => update({ day: Number(event.target.value) })}
          >
            {WEEKDAY_NAMES.map((weekday, index) => (
              <MenuItem key={weekday} value={index + 1}>
                {weekday}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Schulstunde"
            value={form.hour}
            onChange={(event) => {
              const hour = Number(event.target.value);
              update({ hour, double: form.double && hour < LESSONS_PER_DAY });
            }}
          >
            {Array.from({ length: LESSONS_PER_DAY }, (_, index) => (
              <MenuItem key={index} value={index + 1}>
                {index + 1}. Stunde
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            label="Doppelstunde"
            control={
              <Switch
                checked={form.double}
                disabled={form.hour >= LESSONS_PER_DAY}
                onChange={(event) => update({ double: event.target.checked })}
              />
            }
          />
        </div>

        {collisions.length > 0 && (
          <Alert severity="warning" className="mt-4">
            Zu dieser Zeit findet bereits statt:{" "}
            {collisions
              .map((other) => `${formatClassName(other)} ${other.subject}`)
              .join(", ")}
          </Alert>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-wider text-muted uppercase">
            Schüler · {roster.length}
          </h3>
          <div className="flex flex-wrap gap-2">
            {otherClasses.length > 0 && (
              <TextField
                select
                size="small"
                label="Aus Klasse übernehmen"
                value=""
                className="w-60"
                onChange={async (event) => {
                  const source = await getClassStudents(
                    Number(event.target.value),
                  );
                  addStudents(source.map(({ id, name }) => ({ id, name })));
                }}
              >
                {otherClasses.map((other) => (
                  <MenuItem key={other.id} value={other.id}>
                    {formatClassName(other)} {other.subject} (
                    {formatSchoolYear(other.year)})
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="outlined"
              onClick={() => setPasteText(pasteText == null ? "" : null)}
            >
              Liste einfügen
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                const key = `n${nextKey.current++}`;
                setRoster((prev) => [...prev, { key, name: "" }]);
                setFocusKey(key);
              }}
            >
              Schüler hinzufügen
            </Button>
          </div>
        </div>

        {pasteText != null && (
          <div className="mt-2 flex flex-col gap-2">
            <TextField
              multiline
              minRows={4}
              autoFocus
              label="Ein Name pro Zeile"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
            />
            <Button
              className="self-end"
              variant="contained"
              onClick={() => {
                addStudents(parsePaste(pasteText));
                setPasteText(null);
              }}
            >
              Übernehmen
            </Button>
          </div>
        )}

        <div className="mt-2 grid grid-cols-1 gap-2 landscape:grid-cols-2">
          {roster.map((row) => (
            <div key={row.key} className="flex items-center gap-1">
              <TextField
                size="small"
                fullWidth
                placeholder="Name"
                autoFocus={row.key == focusKey}
                value={row.name}
                onChange={(event) =>
                  setRoster((prev) =>
                    prev.map((r) =>
                      r.key == row.key ? { ...r, name: event.target.value } : r,
                    ),
                  )
                }
              />
              <IconButton
                color="error"
                aria-label={`${row.name} entfernen`}
                onClick={() => (row.id ? setRemoving(row) : removeRow(row))}
              >
                <TrashIcon size={18} />
              </IconButton>
            </div>
          ))}
        </div>
      </DialogContent>

      <DialogActions>
        {cls && (
          <Button
            color="error"
            onClick={() => setConfirmDelete(true)}
            sx={{ mr: "auto" }}
          >
            Klasse löschen
          </Button>
        )}
        <Button color="error" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          disabled={!form.subject.trim() || saving}
          onClick={save}
        >
          Speichern
        </Button>
      </DialogActions>

      <ConfirmDialog
        open={!!removing}
        title={`${removing?.name} entfernen?`}
        confirmLabel="Entfernen"
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeRow(removing)}
      >
        Beim Speichern werden auch alle Noten und Kommentare in dieser Klasse
        gelöscht.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmDelete}
        title="Klasse löschen?"
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      >
        Die Klasse wird mit allen Noten, Kommentaren und der Sitzordnung
        gelöscht.
      </ConfirmDialog>
    </Dialog>
  );
}
