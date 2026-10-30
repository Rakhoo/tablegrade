import {
  Alert,
  Autocomplete,
  Avatar,
  Button,
  ButtonBase,
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
  type Trait,
} from "../../db";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  fillNicknames,
  mergeStudents,
  parseStudentList,
  toRosterEntry,
} from "../../lib/studentRoster";
import { StudentDialog } from "./StudentDialog";
import { TrashIcon } from "../../components/icons";
import {
  formatClassName,
  formatSchoolYear,
  formatStudentName,
} from "../../lib/formatters";
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
  traits: Trait[];
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
  traits,
  preset,
  onSave,
  onDelete,
  onCancel,
}: ClassEditDialogProps) {
  const [form, setForm] = useState<ClassForm>(
    () => cls ?? emptyForm(holidays, preset),
  );
  const [roster, setRoster] = useState<RosterRow[]>(() =>
    students.map((student) => ({
      ...toRosterEntry(student),
      key: `s${student.id}`,
    })),
  );
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RosterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(0);
  const [editingStudent, setEditingStudent] = useState<
    RosterRow | "new" | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);

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

  const createRow = (entry: RosterEntry): RosterRow => ({
    ...entry,
    key: `n${nextKey.current++}`,
  });

  /** Merges a pasted list into the roster and prefills nicknames of equal first names. */
  const mergeList = (rows: RosterRow[], text: string) =>
    fillNicknames(mergeStudents(rows, parseStudentList(text), createRow).rows);

  /** Adds the students of another class, skipping students already in the roster. */
  const copyStudents = (entries: RosterEntry[]) =>
    setRoster((prev) =>
      fillNicknames([
        ...prev,
        ...entries
          .filter((entry) => !prev.some((row) => row.id == entry.id))
          .map(createRow),
      ]),
    );

  /** Reads a WebUntis PDF and matches it with the roster by first and last name. */
  const importPdf = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      // Read first: iOS may discard the picked file once the input is reset
      const data = await file.arrayBuffer();
      // Loaded on demand, as the PDF library is large
      const { readRosterPdf } = await import("../../services/rosterPdf");
      const incoming = await readRosterPdf(data);
      if (!incoming?.length) {
        setImportResult({
          error: true,
          text: "In dieser Datei wurde keine Schülerliste gefunden.",
        });
        return;
      }
      const result = mergeStudents(roster, incoming, createRow);
      setRoster(fillNicknames(result.rows));
      setImportResult({
        text:
          `${result.added} neu, ${result.matched} abgeglichen` +
          (result.missing
            ? `, ${result.missing} nicht in der Datei (bleiben in der Liste)`
            : ""),
      });
    } catch (error) {
      console.error(error);
      // The technical details help with diagnosing, as the iPad has no visible console
      const { name, message } = error as Error;
      setImportResult({
        error: true,
        text: `Die Datei konnte nicht gelesen werden (${name}: ${message}).`,
      });
    } finally {
      // Allow choosing the same file again
      input.value = "";
      setImporting(false);
    }
  };

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
        mergeList(roster, pasteText ?? "").map(toRosterEntry),
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
                  copyStudents(source.map(toRosterEntry));
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
            <Button component="label" variant="outlined" disabled={importing}>
              {importing ? "Wird gelesen …" : "WebUntis-PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => importPdf(event.target)}
              />
            </Button>
            <Button
              variant="outlined"
              onClick={() => setPasteText(pasteText == null ? "" : null)}
            >
              Liste einfügen
            </Button>
            <Button variant="outlined" onClick={() => setEditingStudent("new")}>
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
              label="Ein Schüler pro Zeile: Vorname oder Vorname Nachname"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
            />
            <Button
              className="self-end"
              variant="contained"
              onClick={() => {
                setRoster(mergeList(roster, pasteText));
                setPasteText(null);
              }}
            >
              Übernehmen
            </Button>
          </div>
        )}

        {importResult && (
          <Alert
            severity={importResult.error ? "error" : "success"}
            className="mt-3"
            onClose={() => setImportResult(null)}
          >
            {importResult.text}
          </Alert>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 landscape:grid-cols-2">
          {roster.map((row) => (
            <div key={row.key} className="flex items-center gap-1">
              <ButtonBase
                onClick={() => setEditingStudent(row)}
                className="flex min-w-0 flex-1 items-center justify-start gap-3 rounded-2xl border border-line p-2 text-left"
              >
                <Avatar
                  src={row.image ?? undefined}
                  alt=""
                  sx={{ width: 40, height: 40 }}
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {formatStudentName(row)}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[
                      row.nickname,
                      ...traits
                        .filter((trait) => row.traitIds.includes(trait.id))
                        .map((trait) => trait.name),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "\u00a0"}
                  </span>
                </span>
              </ButtonBase>
              <IconButton
                color="error"
                aria-label={`${formatStudentName(row)} entfernen`}
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

      {editingStudent && (
        <StudentDialog
          student={editingStudent == "new" ? undefined : editingStudent}
          traits={traits}
          onClose={() => setEditingStudent(null)}
          onSave={(student) => {
            setRoster((prev) =>
              editingStudent == "new"
                ? [...prev, createRow(student)]
                : prev.map((row) =>
                    row.key == editingStudent.key
                      ? { ...student, key: row.key }
                      : row,
                  ),
            );
            setEditingStudent(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title={`${removing ? formatStudentName(removing) : ""} entfernen?`}
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
