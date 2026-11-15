import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { PlusIcon, TrashIcon } from "../../components/icons";
import { saveSettings, type SchoolClass } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { toIsoDate } from "../../lib/dates";
import { formatClassName, formatSchoolYear } from "../../lib/formatters";
import {
  buildLetExport,
  getLetMarkColumns,
  getLetMarkSelection,
  type LetBasis,
  type LetCourseChoice,
  type LetCourseData,
  type LetMarkSelection,
} from "../../lib/letHelper";
import { REPORT_LABELS, sortReports, type Report } from "../../lib/reports";
import { downloadFile } from "../../services/backup";
import { loadLetCourse } from "./letCourseLoader";

/** A course in the dialog: its choices, with the basis split into the two kinds' selections. */
type CourseForm = Omit<LetCourseChoice, "basis"> & {
  basisKind: LetBasis["kind"];
  /** Selected report as `reportKey`. */
  report: string;
  /** Selected lesson date. */
  date: string;
};

/** Key of a report within a class. */
const reportKey = ({ date, kind }: Report) => `${date}|${kind}`;

/** Readable date, e.g. "Mo, 10.11.2026". */
const formatDay = (date: string) =>
  format(parseISO(date), "EEEEEE, dd.MM.yyyy", { locale: de });

/** Lesson dates up to today, newest first; today if there is none yet. */
function getDateOptions(data: LetCourseData) {
  const today = toIsoDate(new Date());
  const past = data.dates.filter((date) => date <= today).reverse();
  return past.length > 0 ? past : [today];
}

/** Defaults of a course: its subject, the latest report or else the latest lesson. */
function createForm(data: LetCourseData): CourseForm {
  const latestReport = sortReports(data.reports).at(-1);
  return {
    data,
    subject: data.cls.subject,
    examPrefix: "KA",
    projectPrefix: "Projekt",
    includeExams: true,
    includeProjects: true,
    basisKind: latestReport ? "report" : "date",
    report: latestReport ? reportKey(latestReport) : "",
    date: getDateOptions(data)[0],
  };
}

/** The basis selected in a course form. */
function getBasis(form: CourseForm): LetBasis {
  const report = form.data.reports.find((r) => reportKey(r) == form.report);
  return form.basisKind == "report" && report
    ? { kind: "report", report }
    : { kind: "date", date: form.date };
}

/** Initials as the export wants them: up to three capital letters. */
const cleanInitials = (value: string) =>
  value
    .toLocaleUpperCase("de")
    .replace(/[^A-ZÄÖÜ]/g, "")
    .slice(0, 3);

/** What the oral grade column ("solei") of the file holds, see `LetMarkSelection`. */
const SOLEI_HINTS: Record<LetMarkSelection["solei"], string> = {
  oral: "Als mündliche Note wird die mündliche Note übernommen.",
  total:
    "Als mündliche Note wird die Gesamtnote übernommen, berechnet ohne die ausgelassenen Noten.",
  report:
    "Ohne Klausuren und Projekte wird als mündliche Note die Gesamtnote übernommen, bei einer Teilnote die von Hand korrigierte.",
};

type MarkKindFieldProps = {
  label: string;
  included: boolean;
  prefix: string;
  onChange: (included: boolean, prefix: string) => void;
};

/** Switch whether exams or projects are exported, with the prefix of their names. */
function MarkKindField({
  label,
  included,
  prefix,
  onChange,
}: MarkKindFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <FormControlLabel
        label={label}
        className="w-44 shrink-0"
        control={
          <Switch
            checked={included}
            onChange={(event) => onChange(event.target.checked, prefix)}
          />
        }
      />
      <TextField
        label="Präfix"
        size="small"
        value={prefix}
        disabled={!included}
        className="flex-1"
        onChange={(event) => onChange(included, event.target.value)}
      />
    </div>
  );
}

type CourseFieldsProps = {
  form: CourseForm;
  onChange: (changes: Partial<CourseForm>) => void;
  /** Removes the course; missing for the shown class, which always stays. */
  onRemove?: () => void;
};

/** Settings of one course: subject, period and the prefixes of its exams and projects. */
function CourseFields({ form, onChange, onRemove }: CourseFieldsProps) {
  const { data } = form;
  const columns = getLetMarkColumns(data, getBasis(form));
  const selection = getLetMarkSelection(
    { ...form, basis: getBasis(form) },
    columns,
  );
  const exams = columns.filter((column) => column.kind == "exam").length;
  const projects = columns.length - exams;
  const reports = sortReports(data.reports).reverse();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line p-3">
      <div className="flex min-h-10 items-center justify-between gap-2">
        <h3 className="font-bold">
          {formatClassName(data.cls)} {data.cls.subject}
        </h3>
        {onRemove && (
          <IconButton aria-label="Kurs entfernen" onClick={onRemove}>
            <TrashIcon size={18} />
          </IconButton>
        )}
      </div>
      <TextField
        label="Fach"
        size="small"
        value={form.subject}
        onChange={(event) => onChange({ subject: event.target.value })}
      />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={form.basisKind}
        onChange={(_, value: LetBasis["kind"] | null) =>
          value && onChange({ basisKind: value })
        }
        className="self-start rounded-full bg-brand-50 p-0.5"
      >
        <ToggleButton
          value="report"
          className="toggle-pill"
          disabled={reports.length == 0}
        >
          Teilnote
        </ToggleButton>
        <ToggleButton value="date" className="toggle-pill">
          Zeitpunkt
        </ToggleButton>
      </ToggleButtonGroup>
      {form.basisKind == "report" ? (
        <TextField
          select
          size="small"
          label="Teilnote"
          value={form.report}
          onChange={(event) => onChange({ report: event.target.value })}
        >
          {reports.map((report) => (
            <MenuItem key={reportKey(report)} value={reportKey(report)}>
              {REPORT_LABELS[report.kind]} vom {formatDay(report.date)}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          select
          size="small"
          label="Stand vom"
          value={form.date}
          onChange={(event) => onChange({ date: event.target.value })}
        >
          {getDateOptions(data).map((date) => (
            <MenuItem key={date} value={date}>
              {formatDay(date)}
            </MenuItem>
          ))}
        </TextField>
      )}
      {exams > 0 && (
        <MarkKindField
          label={`Klausuren (${exams})`}
          included={form.includeExams}
          prefix={form.examPrefix}
          onChange={(includeExams, examPrefix) =>
            onChange({ includeExams, examPrefix })
          }
        />
      )}
      {projects > 0 && (
        <MarkKindField
          label={`Projekte (${projects})`}
          included={form.includeProjects}
          prefix={form.projectPrefix}
          onChange={(includeProjects, projectPrefix) =>
            onChange({ includeProjects, projectPrefix })
          }
        />
      )}
      <p className="text-sm text-muted">{SOLEI_HINTS[selection.solei]}</p>
    </section>
  );
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
 * prefixes per course) and downloads it.
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
  const addable = otherClasses.filter((cls) =>
    forms.every((form) => form.data.cls.id != cls.id),
  );
  const valid =
    initials.length > 0 && forms.every((form) => form.subject.trim() != "");

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
      setForms((current) => [...current, createForm(data)]);
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
      );
      downloadFile(new File([json], fileName, { type: "application/json" }));
      onClose();
      onDone("Die Datei für den LET-Helfer wurde heruntergeladen.");
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
          {forms.map((form, index) => (
            <CourseFields
              key={form.data.cls.id}
              form={form}
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
