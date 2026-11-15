import {
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { TrashIcon } from "../../components/icons";
import { formatClassName } from "../../lib/formatters";
import {
  getLetMarkColumns,
  getLetMarkSelection,
  type LetBasis,
  type LetMarkSelection,
} from "../../lib/letHelper";
import {
  formatLetCourse,
  isSameLetClass,
  type LetFileCourse,
} from "../../lib/letMerge";
import { REPORT_LABELS, sortReports } from "../../lib/reports";
import {
  formatDay,
  getBasis,
  getDateOptions,
  reportKey,
  type CourseForm,
} from "./letCourseForm";

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

/** Value of the "Neu" option of the course choice, never a course id. */
const NEW_COURSE = "new";

type LetCourseFieldsProps = {
  form: CourseForm;
  /** The courses of a loaded file to merge into; `null` without a file. */
  fileCourses: LetFileCourse[] | null;
  /** Courses of the file other forms already go into. */
  takenTargets: string[];
  onChange: (changes: Partial<CourseForm>) => void;
  /** Removes the course; missing for the shown class, which always stays. */
  onRemove?: () => void;
};

/**
 * Settings of one course: the course of a loaded file it goes into or its subject, the period
 * and which exams and projects go in under which prefix.
 */
export function LetCourseFields({
  form,
  fileCourses,
  takenTargets,
  onChange,
  onRemove,
}: LetCourseFieldsProps) {
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
      {fileCourses && (
        <TextField
          select
          size="small"
          label="Kurs in der Datei"
          value={form.target ?? NEW_COURSE}
          onChange={(event) =>
            onChange({
              target:
                event.target.value == NEW_COURSE ? null : event.target.value,
            })
          }
        >
          {fileCourses
            .filter((course) =>
              isSameLetClass(course, formatClassName(data.cls)),
            )
            .map((course) => (
              <MenuItem
                key={course.id}
                value={course.id}
                disabled={takenTargets.includes(course.id)}
              >
                {formatLetCourse(course)}
              </MenuItem>
            ))}
          <MenuItem value={NEW_COURSE} className="text-brand-700">
            – Neu erstellen –
          </MenuItem>
        </TextField>
      )}
      {form.target == null && (
        <TextField
          label="Fach"
          size="small"
          value={form.subject}
          onChange={(event) => onChange({ subject: event.target.value })}
        />
      )}
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
