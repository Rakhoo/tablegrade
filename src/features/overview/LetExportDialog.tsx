import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { PlusIcon, UploadIcon } from "../../components/icons";
import { saveSettings, type SchoolClass } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { formatClassName, formatSchoolYear } from "../../lib/formatters";
import { buildLetExport, type LetCourseData } from "../../lib/letHelper";
import { findLetTarget, parseLetFile, type LetFile } from "../../lib/letMerge";
import { saveFile } from "../../services/backup";
import { LetCourseFields } from "./LetCourseFields";
import { createForm, getBasis, type CourseForm } from "./letCourseForm";
import { loadLetCourse } from "./letCourseLoader";

/** Initials as the export wants them: up to three capital letters. */
const cleanInitials = (value: string) =>
  value
    .toLocaleUpperCase("de")
    .replace(/[^A-ZÄÖÜ]/g, "")
    .slice(0, 3);

/**
 * Points each form at the course of a file it fits best, one course per form at most.
 * @param courses The file's courses; `null` sets all forms to new courses.
 */
function assignTargets(
  forms: CourseForm[],
  courses: LetFile["courses"] | null,
) {
  const taken: string[] = [];
  return forms.map((form) => {
    const target = courses
      ? findLetTarget(
          courses,
          formatClassName(form.data.cls),
          form.subject,
          taken,
        )
      : null;
    if (target) taken.push(target);
    return { ...form, target };
  });
}

type LetExportDialogProps = {
  /** The class of the overview, always exported first. */
  course: LetCourseData;
  /** Classes of the same school year half that can be added. */
  otherClasses: SchoolClass[];
  onClose: () => void;
  /** Reports the outcome as a message. */
  onDone: (message: string) => void;
};

/**
 * Asks for what the "LET-Helfer" file needs (initials, subject, LET 1 or 2, period and
 * prefixes per course) and downloads it; a loaded file of the LET-Helfer gets the courses
 * merged in instead.
 */
export function LetExportDialog({
  course,
  otherClasses,
  onClose,
  onDone,
}: LetExportDialogProps) {
  const settings = useSettings();
  const { revalidate } = useRevalidator();
  const [initials, setInitials] = useState(settings.letHelperInitials);
  const [letNr, setLetNr] = useState<1 | 2>(1);
  const [forms, setForms] = useState(() => [createForm(course)]);
  const [loading, setLoading] = useState(false);
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);
  /** A file of the LET-Helfer to merge into, with its name. */
  const [file, setFile] = useState<{ name: string; content: LetFile } | null>(
    null,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const addable = otherClasses.filter((cls) =>
    forms.every((form) => form.data.cls.id != cls.id),
  );
  const valid =
    initials.length > 0 &&
    forms.every((form) => form.target != null || form.subject.trim() != "");
  const targetsOf = (except: CourseForm) =>
    forms.flatMap((form) =>
      form != except && form.target != null ? [form.target] : [],
    );

  /** Reads a file to merge into, takes over its initials and LET and matches the courses. */
  const loadFile = async (input: HTMLInputElement) => {
    const selected = input.files?.[0];
    // Lets the same file be chosen again
    input.value = "";
    if (!selected) return;
    try {
      const content = parseLetFile(await selected.text());
      const fileInitials = cleanInitials(String(content.kuerzel ?? ""));
      const fileLet = (content.let as { letNr?: unknown } | undefined)?.letNr;
      if (fileInitials) setInitials(fileInitials);
      if (fileLet == 1 || fileLet == 2) setLetNr(fileLet as 1 | 2);
      setFile({ name: selected.name, content });
      setFileError(null);
      setForms((current) => assignTargets(current, content.courses));
    } catch (error) {
      setFileError((error as Error).message);
    }
  };

  const removeFile = () => {
    setFile(null);
    setForms((current) => assignTargets(current, null));
  };

  const updateForm = (index: number, changes: Partial<CourseForm>) =>
    setForms((current) =>
      current.map((form, other) =>
        other == index ? { ...form, ...changes } : form,
      ),
    );

  const addCourse = async (cls: SchoolClass) => {
    setLoading(true);
    try {
      const data = await loadLetCourse(cls);
      setForms((current) => {
        const form = createForm(data);
        const target = file
          ? findLetTarget(
              file.content.courses,
              formatClassName(data.cls),
              data.cls.subject,
              current.flatMap((other) => other.target ?? []),
            )
          : null;
        return [...current, { ...form, target }];
      });
    } finally {
      setLoading(false);
    }
  };

  const runExport = async () => {
    try {
      const { fileName, json } = buildLetExport(
        initials,
        letNr,
        forms.map((form) => ({ ...form, basis: getBasis(form) })),
        settings,
        file?.content ?? null,
      );
      // Like the backup: the share sheet on the iPad, so it can go straight to "Dateien"
      const saved = await saveFile(
        new File([json], fileName, { type: "application/json" }),
      );
      // Closing the share sheet keeps the dialog with its input for another try
      if (!saved) return;
      onClose();
      onDone("Die Datei für den LET-Helfer wurde gespeichert.");
      if (initials != settings.letHelperInitials) {
        await saveSettings({ letHelperInitials: initials });
        await revalidate();
      }
    } catch (error) {
      onClose();
      onDone(`Der Export ist fehlgeschlagen (${(error as Error).message}).`);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Export für den LET-Helfer</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3">
            <TextField
              label="Kürzel"
              size="small"
              value={initials}
              onChange={(event) =>
                setInitials(cleanInitials(event.target.value))
              }
              className="w-28"
              autoFocus={!initials}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={letNr}
              onChange={(_, value: 1 | 2 | null) => value && setLetNr(value)}
              className="rounded-full bg-brand-50 p-0.5"
            >
              <ToggleButton value={1} className="toggle-pill">
                LET 1
              </ToggleButton>
              <ToggleButton value={2} className="toggle-pill">
                LET 2
              </ToggleButton>
            </ToggleButtonGroup>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadIcon size={18} />}
            >
              {file ? "Andere Datei wählen" : "Bestehende Datei ergänzen"}
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => loadFile(event.target)}
              />
            </Button>
            {file && <Chip label={file.name} onDelete={removeFile} />}
          </div>
          {fileError && (
            <Alert severity="error" onClose={() => setFileError(null)}>
              {fileError}
            </Alert>
          )}
          {forms.map((form, index) => (
            <LetCourseFields
              key={form.data.cls.id}
              form={form}
              fileCourses={file?.content.courses ?? null}
              takenTargets={targetsOf(form)}
              onChange={(changes) => updateForm(index, changes)}
              onRemove={
                index == 0
                  ? undefined
                  : () =>
                      setForms((current) =>
                        current.filter((other) => other != form),
                      )
              }
            />
          ))}
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="outlined"
              startIcon={<PlusIcon size={18} />}
              disabled={addable.length == 0 || loading}
              onClick={(event) => setAddMenu(event.currentTarget)}
            >
              Weiteren Kurs hinzufügen
            </Button>
            <p className="text-sm text-muted">
              {otherClasses.length == 0
                ? `Kein weiterer Kurs in diesem Halbjahr (${formatSchoolYear(course.cls.year)}).`
                : addable.length == 0
                  ? "Alle Kurse des Halbjahres sind schon dabei."
                  : `Jeder andere Kurs aus diesem Halbjahr (${formatSchoolYear(course.cls.year)}).`}
            </p>
          </div>
          <Menu
            anchorEl={addMenu}
            open={!!addMenu}
            onClose={() => setAddMenu(null)}
          >
            {addable.map((cls) => (
              <MenuItem
                key={cls.id}
                onClick={() => {
                  setAddMenu(null);
                  addCourse(cls);
                }}
              >
                {formatClassName(cls)} {cls.subject}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" disabled={!valid} onClick={runExport}>
          Exportieren
        </Button>
      </DialogActions>
    </Dialog>
  );
}
