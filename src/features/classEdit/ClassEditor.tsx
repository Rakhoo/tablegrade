import { Alert, Button, TextField } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import {
  getClassStudents,
  saveSchoolClass,
  type RosterEntry,
  type SchoolClass,
  type SchoolYearPart,
  type SeatedStudent,
  type Trait,
} from "../../db";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useSettings } from "../../hooks/useSettings";
import { sortCopyClasses } from "../../lib/classCopy";
import {
  fillNicknames,
  getImportNickname,
  mergeStudents,
  parseStudentList,
  toRosterEntry,
} from "../../lib/studentRoster";
import { ClassFields, type ClassForm } from "./ClassFields";
import { MissingYearAlert } from "./MissingYearAlert";
import { RosterList, type RosterRow } from "./RosterList";
import { RosterTools } from "./RosterTools";
import { StudentDialog } from "./StudentDialog";
import { TrashIcon } from "../../components/icons";
import { formatClassName, formatStudentName } from "../../lib/formatters";
import {
  doSchoolClassesCollide,
  getSchoolYear,
  getSchoolYearPart,
  type SchoolCalendar,
} from "../../lib/schoolYear";
import { hasLetters, type AppSettings } from "../../lib/settings";

type ClassEditorProps = {
  /** The edited class, `undefined` when creating a new one. */
  cls?: SchoolClass;
  students: SeatedStudent[];
  allClasses: SchoolClass[];
  subjects: string[];
  calendar: SchoolCalendar;
  /** The school years in use, the only ones a class can belong to. */
  schoolYears: { year: number }[];
  traits: Trait[];
  /** Presets for new classes: weekday and lesson from a timetable cell, or the half from the overview selection. */
  preset: {
    day?: number;
    hour?: number;
    date: Date;
    /** School year and half, instead of the ones of `date`. */
    year?: number;
    part?: SchoolYearPart;
  };
  /** Creates the new class; existing classes are saved right after each change. */
  onCreate?: (form: ClassForm, roster: RosterEntry[]) => Promise<void>;
  /** Leaves the creation of a new class without saving. */
  onCancel?: () => void;
  /** Reports whether a new class has input that leaving would discard. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Asks before the settings link leaves the page; calls `leave` to follow it. */
  onLeave?: (leave: () => void) => void;
  /** Called after each automatic save of an existing class. */
  onSaved: () => void;
  onDelete: () => Promise<void>;
};

/** Delay after the last change of the class information before it is saved. */
const SAVE_DELAY_MS = 500;

const toRows = (students: SeatedStudent[]): RosterRow[] =>
  students.map((student) => ({
    ...toRosterEntry(student),
    key: `s${student.id}`,
  }));

/** Initial form values for a new class in the preset school year half, else the one of the preset date. */
function emptyForm(
  calendar: SchoolCalendar,
  settings: AppSettings,
  years: number[],
  preset: ClassEditorProps["preset"],
): ClassForm {
  const year = preset.year ?? getSchoolYear(preset.date, calendar);
  return {
    subject: "",
    number: settings.levels[0],
    letter: settings.letters[0],
    year: years.includes(year) ? year : (years.at(-1) ?? year),
    part: preset.part ?? getSchoolYearPart(preset.date, calendar),
    day: preset.day ?? 1,
    hour: preset.hour ?? 1,
    double: false,
    day2: null,
    hour2: null,
    double2: false,
  };
}

/**
 * Page content with all class information and the student list. Changes of an existing class
 * are saved right away; a new class is only created with "Speichern".
 * Its state is initialized from the props once.
 */
export function ClassEditor({
  cls,
  students,
  allClasses,
  subjects,
  calendar,
  schoolYears,
  traits,
  preset,
  onCreate,
  onCancel,
  onDirtyChange,
  onLeave,
  onSaved,
  onDelete,
}: ClassEditorProps) {
  const settings = useSettings();
  const years = schoolYears.map(({ year }) => year);
  const [form, setForm] = useState<ClassForm>(
    () => cls ?? emptyForm(calendar, settings, years, preset),
  );
  const [roster, setRosterState] = useState<RosterRow[]>(() =>
    toRows(students),
  );
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [initialForm] = useState(form);
  const dirty =
    !cls &&
    (JSON.stringify(form) != JSON.stringify(initialForm) ||
      roster.length > 0 ||
      !!pasteText?.trim());
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const [removing, setRemoving] = useState<RosterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The latest state for the queued saves, which run after the render they were started in
  const formRef = useRef(form);
  const rosterRef = useRef(roster);
  const queue = useRef(Promise.resolve());
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextKey = useRef(0);
  const [editingStudent, setEditingStudent] = useState<
    RosterRow | "new" | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);

  // A new class for a school year that is not set up (yet), e.g. the timetable's week, waits for
  // the settings, unless it is created in one of the existing school years instead
  const presetYear = preset.year ?? getSchoolYear(preset.date, calendar);
  const [inExistingYear, setInExistingYear] = useState(false);
  const missingYear =
    years.length == 0 ||
    (!cls && !years.includes(presetYear) && !inExistingYear);

  /** The form as it is saved; `null` while it cannot be saved. */
  const toSaved = (current: ClassForm) =>
    current.subject.trim() && !missingYear
      ? {
          ...current,
          subject: current.subject.trim(),
          letter: !hasLetters(current.number)
            ? null
            : (current.letter ?? settings.letters[0]),
        }
      : null;

  /** Runs saves one after the other, so they never overlap. */
  const enqueue = (job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch((error) => {
      console.error(error);
      const { name, message } = error as Error;
      setSaveError(`Speichern fehlgeschlagen (${name}: ${message}).`);
    });
  };

  /**
   * Saves an existing class with the latest form and roster. The roster is reloaded after a
   * change of it, so new students get their ids before the next save.
   */
  const persist = async (reload: boolean) => {
    const saved = toSaved(formRef.current);
    if (!cls || !saved) return;
    await saveSchoolClass(
      { ...saved, id: cls.id },
      rosterRef.current.map(toRosterEntry),
    );
    setSaveError(null);
    if (reload) {
      rosterRef.current = toRows(await getClassStudents(cls.id));
      setRosterState(rosterRef.current);
    }
    onSaved();
  };

  // Leaving the page right after typing still saves the last change
  const flushPendingSave = useRef(() => undefined as void);
  useEffect(() => {
    flushPendingSave.current = () => {
      if (!pendingSave.current) return;
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
      enqueue(() => persist(false));
    };
  });
  useEffect(() => () => flushPendingSave.current(), []);

  const update = (changes: Partial<ClassForm>) => {
    formRef.current = { ...formRef.current, ...changes };
    setForm(formRef.current);
    if (!cls) return;
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => {
      pendingSave.current = null;
      enqueue(() => persist(false));
    }, SAVE_DELAY_MS);
  };

  /** Changes the roster; for an existing class queued with its save, on the latest roster. */
  const setRoster = (change: (prev: RosterRow[]) => RosterRow[]) => {
    const apply = () => {
      rosterRef.current = change(rosterRef.current);
      setRosterState(rosterRef.current);
    };
    if (!cls) return apply();
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = null;
    enqueue(async () => {
      apply();
      await persist(true);
    });
  };
  const hasNoLetter = !hasLetters(form.number);

  const draft = { ...form, id: cls?.id ?? -1 };
  const collisions = allClasses.filter(
    (other) =>
      other.id != cls?.id && doSchoolClassesCollide(draft, other, calendar),
  );
  const otherClasses = allClasses.filter((other) => other.id != cls?.id);
  const copyOptions = sortCopyClasses(otherClasses);

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

  /** Copies the visible students of another class with their seats. */
  const copyFrom = async (source: SchoolClass) => {
    const sourceStudents = await getClassStudents(source.id);
    copyStudents(
      sourceStudents
        .filter((student) => !student.hidden)
        .map((student) => ({
          ...toRosterEntry(student),
          seat:
            student.x != null && student.y != null
              ? { x: student.x, y: student.y }
              : undefined,
        })),
    );
  };

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
      const result = mergeStudents(
        roster,
        incoming.map((student) => ({
          ...student,
          nickname: getImportNickname(student.firstName),
        })),
        createRow,
      );
      setRoster(() => fillNicknames(result.rows));
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

  const create = async () => {
    const saved = toSaved(form);
    if (!saved) return;
    setSaving(true);
    try {
      // A pasted list that was not applied yet is saved as well
      await onCreate?.(
        saved,
        mergeList(roster, pasteText ?? "").map(toRosterEntry),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      className="card flex min-h-0 flex-1 flex-col"
      data-help={
        cls
          ? "Angaben und Schülerliste der Klasse; Änderungen werden sofort gespeichert."
          : "Angaben und Schülerliste der neuen Klasse; erst „Speichern“ legt sie an."
      }
    >
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {saveError && (
          <Alert severity="error" className="mb-3">
            {saveError}
          </Alert>
        )}
        {cls && !form.subject.trim() && (
          <Alert severity="warning" className="mb-3">
            Ohne Fach wird nichts gespeichert.
          </Alert>
        )}
        {missingYear && (
          <MissingYearAlert
            years={years}
            year={presetYear}
            onLeave={onLeave}
            onUseExistingYear={() => setInExistingYear(true)}
          />
        )}
        <ClassFields
          form={form}
          onChange={update}
          years={years}
          subjects={subjects}
        />

        {collisions.length > 0 && (
          <Alert severity="warning" className="mt-4">
            Zu dieser Zeit findet bereits statt:{" "}
            {collisions
              .map((other) => `${formatClassName(other)} ${other.subject}`)
              .join(", ")}
          </Alert>
        )}

        <RosterTools
          count={roster.length}
          classes={copyOptions}
          target={{ ...form, letter: hasNoLetter ? null : form.letter }}
          levels={settings.levels}
          importing={importing}
          onCopy={copyFrom}
          onImport={importPdf}
          onPaste={() => setPasteText(pasteText == null ? "" : null)}
          onAdd={() => setEditingStudent("new")}
        />

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
                setRoster((prev) => mergeList(prev, pasteText));
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

        <RosterList
          rows={roster}
          traits={traits}
          onEdit={setEditingStudent}
          onToggleHidden={(row) =>
            setRoster((prev) =>
              prev.map((other) =>
                other.key == row.key
                  ? { ...other, hidden: !other.hidden }
                  : other,
              ),
            )
          }
          onRemove={(row) => (row.id ? setRemoving(row) : removeRow(row))}
        />
        {cls && (
          <div className="mt-8 border-t border-line pt-4">
            <Button
              color="error"
              variant="outlined"
              startIcon={<TrashIcon size={18} />}
              onClick={() => setConfirmDelete(true)}
            >
              Klasse löschen
            </Button>
          </div>
        )}
      </div>

      {!cls && (
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button color="error" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            disabled={!toSaved(form) || saving}
            onClick={create}
          >
            Speichern
          </Button>
        </div>
      )}

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
        {cls
          ? "Alle Noten und Kommentare des Schülers in dieser Klasse werden gelöscht."
          : "Der Schüler wird aus der Liste entfernt."}
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
    </main>
  );
}
