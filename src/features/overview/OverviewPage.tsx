import {
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Snackbar,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Link,
  useLoaderData,
  useLocation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { CancelDialog } from "../../components/CancelDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GradeIcon } from "../../components/GradeIcon";
import { BackButton } from "../../components/BackButton";
import { GradeToolBar } from "../../components/GradeToolBar";
import { HistoryButtons } from "../../components/HistoryButtons";
import { ModeBar, ModeToggle } from "../../components/ModeBar";
import {
  SpeedDialLayout,
  type SpeedDialEntry,
  type SpeedDialLink,
} from "../../components/SpeedDial";
import {
  CardsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  CommentIcon,
  DownloadIcon,
  BadgeIcon,
  ImageIcon,
  ImageOffIcon,
  TagOffIcon,
  PencilIcon,
  SeatsIcon,
  SmileIcon,
  TagIcon,
} from "../../components/icons";
import { LessonTypeBadge, Pill } from "../../components/LessonTypeBadge";
import { MarkBadge } from "../../components/MarkBadge";
import { SuggestedGradeIcon } from "../../components/SuggestedGradeIcon";
import {
  addReport,
  removeReport,
  type GradeEntry,
  type SeatedStudent,
} from "../../db";
import { useEditHistory } from "../../hooks/useEditHistory";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import { useLongPress } from "../../hooks/useLongPress";
import { useSettings } from "../../hooks/useSettings";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { suggestGrade } from "../../lib/assessment";
import {
  formatClassName,
  formatSchoolYear,
  formatStudentName,
  getCommentPreview,
  getStudentLabel,
} from "../../lib/formatters";
import {
  DEFAULT_GRADE_TOOL,
  formatMark,
  getToolValue,
  getValidGradeTool,
  isExamDay,
  MARK_FIELD,
  MARK_KIND,
  type MarkKind,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import {
  LESSON_TYPE_LABELS,
  LESSON_TYPE_ORDER,
  lessonKey,
} from "../../lib/lessons";
import {
  canBeFollowUp,
  getLessonChains,
  getLessonCompletion,
  type FollowUpType,
  getLessonTypeLabel,
  isMarkLocked,
} from "../../lib/lessonChains";
import {
  getColumnKey,
  getOverviewColumns,
  type LessonColumn,
} from "../../lib/overview";
import {
  getReportChangeError,
  getReportColumns,
  REPORT_LABELS,
  type Report,
  type ReportColumn,
  type ReportKind,
} from "../../lib/reports";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { getVisibleGrades } from "../../lib/settings";
import {
  describeValues,
  FAIL_TOOL,
  getToolValues,
} from "../../services/grading";
import { CommentDialog } from "../classroom/CommentDialog";
import type { OverviewLoaderData } from "./overviewLoader";

const entryKey = (studentId: number, date: string) => `${studentId}|${date}`;

/** What a tap on a cell does: nothing (viewing), apply the grading tool or edit the comment. */
type OverviewMode = "view" | "grade" | "comment";

/** Cell tints like a soft checkerboard: the row picks the hue, the column the strength. */
const CELL_TINTS = [
  ["var(--color-brand-50)", "var(--color-brand-100)"],
  ["var(--color-blush-50)", "var(--color-blush-100)"],
];

/** Marker of a report grade set by hand where too few assessments gave "n.b.". */
const OVERRIDE_COLOR = "#ca8a04";

/** Frame of the cells in the column of the current lesson. */
const LESSON_FRAME =
  "inset 2px 0 0 var(--color-brand-500), inset -2px 0 0 var(--color-brand-500)";

/** Header tints per column, matching the strength of the names in the first column. */
const HEADER_TINTS = ["var(--color-brand-50)", "var(--color-brand-200)"];

/** Colors setting the columns of a report apart from the lessons and each other. */
const REPORT_COLORS: Record<ReportKind, string> = {
  partial: "#0f766e",
  half: "#b45309",
};

/** A report's color mixed into the surface, which adapts it to light and dark mode. */
const getReportTint = (kind: ReportKind, strength: number) =>
  `color-mix(in srgb, ${REPORT_COLORS[kind]} ${strength}%, var(--color-surface))`;

type DateHeaderProps = {
  date: string;
  index: number;
  columns: number;
  isComplete: boolean;
  isCancelled: boolean;
  /** The current lesson (`?date=`), highlighted. */
  isCurrent: boolean;
  /** The type a mark column belongs to; oral columns have none. */
  lessonType: LessonType | null;
  /** Label of the type, e.g. the part of a project. */
  typeLabel: string;
  /** Tap on the date, to pick the lesson type. */
  onTap?: (element: HTMLElement) => void;
  onLongPress: () => void;
};

/** Column header with the tilted date; a long press toggles "Ausfall" for the lesson. */
function DateHeader({
  date,
  index,
  columns,
  isComplete,
  isCancelled,
  isCurrent,
  lessonType,
  typeLabel,
  onTap,
  onLongPress,
}: DateHeaderProps) {
  const pressHandlers = useLongPress(onLongPress);
  return (
    <th
      className="sticky top-0 h-24 min-w-11 border-b border-line bg-surface"
      data-date={date}
      // Earlier columns stay on top, so their slanted headers are not covered
      style={{ zIndex: 10 + columns - index, WebkitTouchCallout: "none" }}
      onClick={(event) => onTap?.(event.currentTarget)}
      {...pressHandlers}
    >
      {/* Colored band slanted like the text, connecting the date with its column */}
      <span
        className="absolute inset-0 origin-bottom -skew-x-30"
        style={{
          background: isCancelled
            ? "var(--color-line)"
            : isCurrent
              ? "var(--color-brand-500)"
              : HEADER_TINTS[index % 2],
        }}
      />
      {/* Rotates around its vertical center, placed on the band's center line, which keeps
          the date, with or without marker, at an equal distance from both band edges */}
      <span
        className={
          "absolute bottom-2.5 flex origin-left flex-col items-start gap-0.5 text-xs font-medium whitespace-nowrap " +
          (isCancelled
            ? "text-muted line-through"
            : isCurrent
              ? "font-bold text-white"
              : "")
        }
        style={{
          left: "calc(50% + 6px)",
          transform: "translateY(50%) rotate(-60deg)",
        }}
      >
        <span className="flex items-center gap-1">
          {format(parseISO(date), "dd.MM.yy")}
          {isComplete && (
            <span style={{ color: "#15803d" }}>
              <CheckIcon size={13} strokeWidth={3} />
            </span>
          )}
        </span>
        {lessonType && <LessonTypeBadge type={lessonType} label={typeLabel} />}
      </span>
    </th>
  );
}

type ReportHeaderProps = {
  column: ReportColumn;
  index: number;
  columns: number;
  onTap: (element: HTMLElement) => void;
};

/** Height of a date header times the tangent of its slant: how far its top is shifted right. */
const HEADER_SLANT = "calc(6rem * 0.577)";

/** Column header of a report: without date, its first column carries a pill across the report. */
function ReportHeader({ column, index, columns, onTap }: ReportHeaderProps) {
  return (
    <th
      className="sticky top-0 h-24 min-w-11 border-b border-line bg-surface"
      style={{ zIndex: 10 + columns - index }}
      onClick={(event) => onTap(event.currentTarget)}
    >
      <span
        className="absolute inset-0 origin-bottom -skew-x-30"
        style={{
          background: getReportTint(column.report, 22 + 8 * (index % 2)),
        }}
      />
      <span
        className="absolute bottom-2.5 flex origin-left text-xs font-medium whitespace-nowrap"
        style={{
          left: "calc(50% + 6px)",
          transform: "translateY(50%) rotate(-60deg)",
        }}
      >
        {column.label}
      </span>
      {column.groupSize > 0 && (
        <span
          className="absolute top-1 z-10 flex justify-center whitespace-nowrap"
          style={{
            left: HEADER_SLANT,
            minWidth: `${column.groupSize * 100}%`,
          }}
        >
          <Pill color={REPORT_COLORS[column.report]}>
            {REPORT_LABELS[column.report]}
          </Pill>
        </span>
      )}
    </th>
  );
}

/**
 * Overview table of a class and school year half: students in rows, lesson dates in columns
 * and the symbols at their intersections. In the grading mode tapping a cell applies the tool.
 */
export function OverviewPage() {
  const {
    class: cls,
    students,
    entries,
    dates,
    days,
    lessons,
    lessonTypes,
    traits,
    reports,
    reportGrades,
    seatingDate,
    previous,
    next,
  } = useLoaderData<OverviewLoaderData>();
  const location = useLocation();
  const settings = useSettings();
  const visibleGrades = getVisibleGrades(settings);
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const [mode, setModeState] = useState<OverviewMode>("view");
  /** Student whose entries alone stay visible, e.g. to show them to the student. */
  const [shownStudent, setShownStudent] = useState<number | null>(null);
  // The arrows switch the class without leaving the page, the student may not be in the new one
  const [shownClass, setShownClass] = useState(cls.id);
  if (shownClass != cls.id) {
    setShownClass(cls.id);
    setShownStudent(null);
  }
  // Looked up instead of trusted, as the render that resets it still sees the old id
  const shown = students.find((student) => student.id == shownStudent);
  const grading = mode == "grade";
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [useNicknames, setUseNicknames] = useDisplayOption("nicknames");
  const [showPhotos, setShowPhotos] = useDisplayOption("photos");
  const [showTraitNames, setShowTraitNames] = useDisplayOption("traits");
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [typeMenu, setTypeMenu] = useState<{
    date: string;
    anchor: HTMLElement;
  } | null>(null);
  const [reportRemoval, setReportRemoval] = useState<{
    report: Report;
    grades: number;
  } | null>(null);
  const [commenting, setCommenting] = useState<{
    student: SeatedStudent;
    date: string;
  } | null>(null);
  const history = useEditHistory(
    cls.id,
    {
      key: `overview/${cls.id}`,
      url: location.pathname + location.search,
      label: "Übersicht",
    },
    revalidate,
  );
  const handleLessonChanged = () => {
    history.reset();
    revalidate();
  };
  const { requestLessonType, lessonTypeDialog } = useLessonTypeChange(
    cls.id,
    handleLessonChanged,
  );

  const entryMap = new Map<string, GradeEntry>(
    entries.map((entry) => [entryKey(entry.studentId, entry.date), entry]),
  );
  // The lesson the seating plan was left from, otherwise today's or the next one
  const lessonDate = searchParams.get("date") ?? seatingDate;
  const typesOf = (date: string): LessonType[] =>
    lessonTypes[lessonKey(cls.id, date)] ?? [];
  const isLessonCancelled = (date: string) =>
    lessons.includes(lessonKey(cls.id, date));
  const isCancelled = (date: string) =>
    days.includes(date) || isLessonCancelled(date);
  const studentIds = students.map((student) => student.id);
  // Exams and projects with their retakes and extensions, which close a student's mark on
  // their other dates once it is given on one
  const chains = getLessonChains(dates, typesOf);
  const hasMark = (kind: MarkKind, studentId: number, date: string) =>
    entryMap.get(entryKey(studentId, date))?.[MARK_FIELD[kind]] != null;
  const isLocked = (student: SeatedStudent, date: string, kind: MarkKind) =>
    isMarkLocked(chains[kind], date, (other) =>
      hasMark(kind, student.id, other),
    );
  /** On a retake day, whether a student writes it: without the exam mark on another date. */
  const isRetaker = (student: SeatedStudent, date: string) =>
    typesOf(date).includes("retake") && !isLocked(student, date, "exam");
  /**
   * Whether a cell is closed: its mark lies on another date, or it is a retaker's oral grade or
   * project mark, as those writing a retake take part in nothing else that day.
   */
  const isCellLocked = (
    student: SeatedStudent,
    { date, kind }: LessonColumn,
  ) =>
    kind == "oral"
      ? isRetaker(student, date)
      : kind == "projectMark"
        ? isLocked(student, date, "project") || isRetaker(student, date)
        : isLocked(student, date, "exam");
  /** Whether a column is complete: oral grades, an exam's or retake's marks, project marks. */
  const isComplete = ({ date, kind }: LessonColumn) => {
    const completion = getLessonCompletion(
      date,
      typesOf(date),
      studentIds,
      entries,
      chains,
    );
    if (kind == "projectMark") return completion.project;
    if (kind == "mark" && !isExamDay(typesOf(date))) return completion.retake;
    return completion.lesson;
  };
  /** The lesson types a date can get; follow-ups only after an incomplete exam or project. */
  const typesFor = (date: string) =>
    LESSON_TYPE_ORDER.filter(
      (type) =>
        type == "exam" ||
        type == "project" ||
        typesOf(date).includes(type) ||
        canBeFollowUp(
          type as FollowUpType,
          date,
          dates,
          typesOf,
          studentIds,
          (studentId, day) => hasMark(MARK_KIND[type], studentId, day),
        ),
    );

  const hasMarkColumns =
    reports.length > 0 ||
    dates.some((date) => !isCancelled(date) && typesOf(date).length > 0);
  // A selected mark does not stay active once no lesson takes marks anymore
  const activeTool = getValidGradeTool(
    tool,
    hasMarkColumns ? undefined : [],
    visibleGrades,
    settings.suggestions,
  );
  const columns = getOverviewColumns(
    dates,
    typesOf,
    getReportColumns(reports, reportGrades, studentIds, entries, settings),
  );

  const tableArea = useRef<HTMLElement>(null);
  // Opening a table shows the lesson's column, or the last one before it, in the middle
  const scrollTarget = lessonDate
    ? dates.filter((date) => date <= lessonDate).at(-1)
    : dates.at(-1);
  useLayoutEffect(() => {
    const area = tableArea.current;
    const header = area?.querySelector<HTMLElement>(
      `th[data-date="${scrollTarget}"]`,
    );
    if (!area || !header) return;
    area.scrollLeft =
      header.offsetLeft - area.clientWidth / 2 + header.offsetWidth / 2;
    // Only when a table or lesson is opened, not on every change of its data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.id, lessonDate]);

  const nameOf = useNicknames ? getStudentLabel : formatStudentName;
  const rows = [...students].sort((a, b) =>
    nameOf(a).localeCompare(nameOf(b), "de"),
  );
  const withPhotos = students.filter((student) => student.image);
  const photoColumn = showPhotos && withPhotos.length > 0;
  // Traits come sorted by name, so this is alphabetical as well
  const traitsOf = (student: SeatedStudent) =>
    traits.filter((trait) => student.traitIds.includes(trait.id));
  const hasTraits = students.some((student) => student.traitIds.length > 0);

  const suggestionFor = (student: SeatedStudent, date: string) =>
    suggestGrade(
      entries.filter((entry) => entry.studentId == student.id),
      date,
      visibleGrades,
    );

  /** Whether a tool can be used in a column: marks in mark columns, symbols in oral ones. */
  const fitsColumn = ({ date, kind }: LessonColumn) => {
    if (isCancelled(date))
      return activeTool == FAIL_TOOL || activeTool == "erase";
    if (activeTool == "erase") return true;
    if (activeTool == "absent") return kind != "projectMark";
    return activeTool.startsWith("mark:") ? kind != "oral" : kind == "oral";
  };

  const handleTap = async (student: SeatedStudent, column: LessonColumn) => {
    const { date } = column;
    if (mode == "comment") return setCommenting({ student, date });
    if (activeTool != "erase" && isCellLocked(student, column)) {
      setMessage(
        column.kind == "oral"
          ? "Wer nachschreibt, bekommt in dieser Stunde keine mündliche Note."
          : column.kind == "projectMark" && isRetaker(student, date)
            ? "Wer nachschreibt, wird in dieser Stunde nicht für das Projekt bewertet."
            : "Dieser Schüler hat seine Note für diese Klausur bzw. dieses Projekt an einem anderen Termin.",
      );
      return;
    }
    if (!fitsColumn(column)) {
      setMessage(
        isCancelled(date)
          ? "Bei Ausfall kann nur die 6 vergeben oder gelöscht werden."
          : "Dieses Werkzeug passt nicht zu dieser Spalte.",
      );
      return;
    }
    const entry = entryMap.get(entryKey(student.id, date));
    if (activeTool == "suggestion" && (entry?.grade != null || entry?.absent)) {
      return;
    }
    const values = getToolValues(
      activeTool == "suggestion"
        ? `grade:${suggestionFor(student, date)}`
        : activeTool,
      typesOf(date),
      column.kind,
    );
    if (values) {
      await history.change(
        "Bewertung",
        student.id,
        date,
        entry,
        values,
        `${describeCell(student, date)}: ${describeValues(values)}`,
      );
    } else {
      setMessage("Dieses Werkzeug passt nicht zu dieser Stunde.");
    }
  };

  /** Tap on a report's grade: marks replace the calculated grade, erasing brings it back. */
  const handleReportTap = async (
    student: SeatedStudent,
    { date, report: kind }: ReportColumn,
  ) => {
    if (!activeTool.startsWith("mark:") && activeTool != "erase") {
      setMessage("Hier können nur Noten gesetzt oder gelöscht werden.");
      return;
    }
    const before =
      reportGrades.find(
        (grade) =>
          grade.date == date &&
          grade.kind == kind &&
          grade.studentId == student.id,
      )?.grade ?? null;
    await history.changeReport(
      { date, kind },
      student.id,
      before,
      activeTool == "erase" ? null : getToolValue(activeTool),
      `${formatStudentName(student)}, ${REPORT_LABELS[kind]}: ${
        activeTool == "erase"
          ? "Vorschlag"
          : formatMark(getToolValue(activeTool))
      }`,
    );
  };

  const hasReport = (date: string, kind: ReportKind) =>
    reports.some((report) => report.date == date && report.kind == kind);

  /** Adds or removes a report; removing asks first if that deletes grades set by hand. */
  const toggleReport = async (date: string, kind: ReportKind) => {
    setTypeMenu(null);
    const report = { date, kind };
    const error = getReportChangeError(reports, report);
    if (error) return setMessage(error);
    if (!hasReport(date, kind)) {
      await addReport(cls.id, report);
      return handleLessonChanged();
    }
    const grades = reportGrades.filter(
      (grade) => grade.date == date && grade.kind == kind,
    ).length;
    if (grades > 0) return setReportRemoval({ report, grades });
    await removeReport(cls.id, report);
    handleLessonChanged();
  };

  const runExport = async (format: "csv" | "pdf") => {
    setExportMenu(null);
    const data = {
      schoolClass: cls,
      title: `${formatClassName(cls)} ${cls.subject}, ${formatSchoolYear(cls.year)}, ${SCHOOL_YEAR_PART_LABELS[cls.part]}`,
      students: rows.map((student) => ({
        id: student.id,
        name: nameOf(student),
        image: showPhotos ? student.image : null,
        traits: showTraitNames ? traitsOf(student) : [],
      })),
      columns,
      entryOf: (studentId: number, date: string) =>
        entryMap.get(entryKey(studentId, date)),
      typesOf,
      settings,
    };
    try {
      const { exportCsv, exportPdf } =
        await import("../../services/overviewExport");
      await (format == "csv" ? exportCsv(data) : exportPdf(data));
      setMessage("Der Export wurde heruntergeladen.");
    } catch (error) {
      console.error(error);
      const { name, message } = error as Error;
      setMessage(`Der Export ist fehlgeschlagen (${name}: ${message}).`);
    }
  };

  const viewLink = (path: string) =>
    `/overview/${cls.id}${path}${lessonDate ? `?date=${lessonDate}` : ""}`;
  /** Name and date of a cell, for the undo history. */
  const describeCell = (student: SeatedStudent, date: string) =>
    `${formatStudentName(student)}, ${format(parseISO(date), "dd.MM.")}`;
  const isHidden = (student: SeatedStudent) =>
    !!shown && student.id != shown.id;

  const seatingLink: SpeedDialLink = {
    key: "seating",
    label: "Sitzplan",
    icon: <SeatsIcon />,
    help: "Sitzplan der Klasse: in der Stunde, aus der diese Übersicht geöffnet wurde, sonst in der heutigen oder nächsten.",
    to: `/classes/${cls.id}${lessonDate ? `?date=${lessonDate}` : ""}`,
  };
  const editEntry: SpeedDialEntry = {
    key: "edit",
    label: "Bearbeiten",
    icon: <PencilIcon />,
    help: "Klasse bearbeiten: Fach, Stunden und Schülerliste.",
    to: viewLink("/edit"),
  };
  const namesEntry: SpeedDialEntry = {
    key: "names",
    label: "Namen lernen",
    icon: <CardsIcon />,
    help: "Karteikarten mit den Fotos, um die Namen der Klasse zu lernen.",
    disabled: withPhotos.length == 0,
    to: viewLink("/names"),
  };
  const tableEntries: SpeedDialEntry[] = [editEntry, namesEntry];
  if (withPhotos.length > 0) {
    tableEntries.push({
      key: "photos",
      label: "Bilder",
      icon: <ImageIcon />,
      offIcon: <ImageOffIcon />,
      checked: showPhotos,
      help: "Zeigt die Fotos vor den Namen.",
      onClick: () => setShowPhotos(!showPhotos),
    });
  }
  tableEntries.push({
    key: "nicknames",
    label: "Spitznamen",
    icon: <SmileIcon />,
    offIcon: <BadgeIcon />,
    checked: useNicknames,
    help: "Zeigt Spitznamen statt der vollen Namen; die Reihenfolge folgt den Namen.",
    onClick: () => setUseNicknames(!useNicknames),
  });
  if (hasTraits) {
    tableEntries.push({
      key: "traits",
      label: "Eigenschaften",
      icon: <TagIcon />,
      offIcon: <TagOffIcon />,
      checked: showTraitNames,
      help: "Zeigt die Eigenschaften ausgeschrieben unter den Namen.",
      onClick: () => setShowTraitNames(!showTraitNames),
    });
  }
  const modes = (
    <ModeToggle
      value={mode}
      onChange={setModeState}
      options={[
        {
          value: "view",
          label: "Betrachten",
          help: "Modus Betrachten: die Tabelle nur ansehen, ein Tipp in eine Zelle ändert nichts.",
        },
        {
          value: "grade",
          label: "Bewerten",
          help: "Modus Bewerten: Werkzeug wählen und Zellen antippen.",
          disabled: dates.length == 0,
        },
        {
          value: "comment",
          label: "Kommentieren",
          help: "Modus Kommentieren: Kommentare der Stunden lesen und schreiben.",
          disabled: dates.length == 0,
        },
      ]}
    />
  );

  const tableHelp =
    "Zeilen sind die Schüler, Spalten die Stunden. Ein Tipp auf ein Datum macht die Stunde zur Klausur oder zum Projekt oder fügt eine Teil- oder Halbjahresnote an, langes Drücken setzt Ausfall. " +
    (mode == "grade"
      ? "Antippen einer Zelle wendet das oben gewählte Werkzeug an; Teil- und Halbjahresnoten lassen sich mit den Noten korrigieren."
      : mode == "comment"
        ? "Sprechblasen zeigen den Anfang der Kommentare; Antippen einer Zelle bearbeitet den Kommentar oder legt einen neuen an."
        : "Zum Ändern oben „Bewerten“ oder „Kommentieren“ wählen.") +
    " Ein Tipp auf einen Namen verdeckt die Einträge aller anderen, etwa um sie dem Schüler zu zeigen.";

  return (
    <SpeedDialLayout entries={tableEntries} links={[seatingLink]}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="justify-self-start">
          <BackButton target="overview" />
        </div>
        <div
          className="flex items-center gap-3"
          data-help="Klasse und Halbjahr der Tabelle. Die Pfeile wechseln zur Übersicht der Klasse, die laut Stundenplan vorher oder danach Unterricht hat."
        >
          <IconButton
            component={Link}
            to={
              previous ? `/overview/${previous.id}?date=${previous.date}` : ""
            }
            replace
            disabled={!previous}
            aria-label="Vorherige Stunde"
            className="bg-surface shadow-tile disabled:opacity-40"
          >
            <ChevronLeftIcon />
          </IconButton>
          <div className="min-w-56 text-center portrait:min-w-44">
            <div className="text-xl font-bold tracking-tight">
              {formatClassName(cls)} · {cls.subject}
            </div>
            <div className="text-sm text-muted">
              {[
                formatSchoolYear(cls.year),
                SCHOOL_YEAR_PART_LABELS[cls.part],
                lessonDate && format(parseISO(lessonDate), "dd.MM."),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <IconButton
            component={Link}
            to={next ? `/overview/${next.id}?date=${next.date}` : ""}
            replace
            disabled={!next}
            aria-label="Nächste Stunde"
            className="bg-surface shadow-tile disabled:opacity-40"
          >
            <ChevronRightIcon />
          </IconButton>
        </div>
        {/* The right end stays free for the speed dial */}
        <div />
      </header>

      <ModeBar
        modes={modes}
        history={<HistoryButtons history={history} />}
        footer={
          shown && (
            <>
              Nur die Einträge von{" "}
              <span className="font-semibold text-ink">{nameOf(shown)}</span>{" "}
              sind sichtbar.
              <Button size="small" onClick={() => setShownStudent(null)}>
                Alle zeigen
              </Button>
            </>
          )
        }
        hint={
          grading
            ? null
            : mode == "comment"
              ? "Zelle antippen, um den Kommentar zu bearbeiten oder einen neuen zu schreiben"
              : "Ein Tipp auf einen Namen zeigt nur dessen Einträge"
        }
      >
        {grading && (
          <GradeToolBar
            tool={activeTool}
            onChange={setTool}
            hideMarks={!hasMarkColumns}
          />
        )}
      </ModeBar>

      <div className="relative min-h-0 flex-1">
        <main
          ref={tableArea}
          className="card h-full overflow-auto"
          data-help={tableHelp}
        >
          {dates.length == 0 || students.length == 0 ? (
            <p className="p-5 text-muted">
              {students.length == 0
                ? "Diese Klasse hat noch keine Schüler."
                : "In diesem Halbjahr gab es noch keinen Unterricht."}
            </p>
          ) : (
            <table className="border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-40 bg-surface p-2 text-left align-top">
                    <Button
                      size="small"
                      data-help="Exportiert die Tabelle als PDF oder CSV."
                      startIcon={<DownloadIcon size={16} />}
                      onClick={(event) => setExportMenu(event.currentTarget)}
                    >
                      Export
                    </Button>
                  </th>
                  {columns.map((column, index) => {
                    if (column.kind == "report") {
                      return (
                        <ReportHeader
                          key={getColumnKey(column)}
                          column={column}
                          index={index}
                          columns={columns.length}
                          onTap={(anchor) =>
                            setTypeMenu({ date: column.date, anchor })
                          }
                        />
                      );
                    }
                    const { date, kind } = column;
                    const columnType =
                      kind == "oral"
                        ? null
                        : (typesOf(date).find(
                            (type) =>
                              MARK_KIND[type] ==
                              (kind == "projectMark" ? "project" : "exam"),
                          ) ?? null);
                    return (
                      <DateHeader
                        key={getColumnKey(column)}
                        date={date}
                        index={index}
                        columns={columns.length}
                        isComplete={isComplete(column)}
                        isCancelled={isCancelled(date)}
                        isCurrent={date == lessonDate}
                        // A mark column carries the type it belongs to, the oral one none
                        lessonType={columnType}
                        typeLabel={
                          columnType
                            ? getLessonTypeLabel(chains, date, columnType)
                            : ""
                        }
                        onTap={
                          isCancelled(date)
                            ? undefined
                            : (anchor) => setTypeMenu({ date, anchor })
                        }
                        // Whole cancelled days are managed in the timetable
                        onLongPress={() =>
                          !days.includes(date) && setCancelTarget(date)
                        }
                      />
                    );
                  })}
                  {/* Room for the tilted date of the last column */}
                  <th className="sticky top-0 min-w-16 border-b border-line bg-surface" />
                </tr>
              </thead>
              <tbody>
                {rows.map((student, rowIndex) => (
                  <tr key={student.id}>
                    <th
                      className="sticky left-0 z-10 border-r border-b border-line p-0 text-left font-semibold whitespace-nowrap"
                      style={{ background: CELL_TINTS[rowIndex % 2][1] }}
                    >
                      <button
                        type="button"
                        aria-pressed={shownStudent == student.id}
                        onClick={() =>
                          setShownStudent(
                            shownStudent == student.id ? null : student.id,
                          )
                        }
                        className={
                          "flex w-full items-center gap-2 px-3 py-1 text-left " +
                          (isHidden(student) ? "opacity-40" : "")
                        }
                      >
                        {photoColumn &&
                          (student.image ? (
                            <img
                              src={student.image}
                              alt=""
                              draggable={false}
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="h-8 w-8 shrink-0" />
                          ))}
                        <div>
                          <div className="flex items-center gap-1.5">
                            {nameOf(student)}
                          </div>
                          {showTraitNames &&
                            !isHidden(student) &&
                            traitsOf(student).length > 0 && (
                              <div className="flex gap-2 text-xs font-semibold">
                                {traitsOf(student).map((trait) => (
                                  <span
                                    key={trait.id}
                                    style={{ color: trait.color }}
                                  >
                                    {trait.name}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      </button>
                    </th>
                    {columns.map((column, columnIndex) => {
                      if (isHidden(student)) {
                        return (
                          <td
                            key={getColumnKey(column)}
                            className="h-11 min-w-11 border-r border-b border-line bg-line p-0"
                          />
                        );
                      }
                      if (column.kind == "report") {
                        const value = column.values.get(student.id) ?? null;
                        const suggestion =
                          column.suggestions.get(student.id) ?? null;
                        return (
                          <td
                            key={getColumnKey(column)}
                            className="h-11 min-w-11 border-r border-b border-line p-0 text-center"
                            style={{
                              background: getReportTint(
                                column.report,
                                12 + 5 * (rowIndex % 2) + 5 * (columnIndex % 2),
                              ),
                            }}
                          >
                            <button
                              type="button"
                              disabled={!grading || !column.main}
                              aria-label={`${formatStudentName(student)}, ${column.label}`}
                              className={
                                "flex h-full min-h-11 w-full items-center justify-center gap-0.5 px-0.5 active:bg-brand-100 " +
                                (column.main ? "" : "opacity-60")
                              }
                              onClick={() => handleReportTap(student, column)}
                            >
                              {value != null ? (
                                <MarkBadge mark={value} />
                              ) : (
                                column.main && (
                                  <span className="text-xs text-muted">
                                    n.b.
                                  </span>
                                )
                              )}
                              {column.main &&
                                value != null &&
                                suggestion != null &&
                                value != suggestion && (
                                  <span
                                    className="font-bold"
                                    style={{
                                      color:
                                        value < suggestion
                                          ? "#15803d"
                                          : "#dc2626",
                                    }}
                                  >
                                    {value < suggestion ? "↑" : "↓"}
                                  </span>
                                )}
                              {/* Set by hand although too few assessments allow a grade */}
                              {column.main &&
                                value != null &&
                                suggestion == null && (
                                  <span
                                    className="font-bold"
                                    style={{ color: OVERRIDE_COLOR }}
                                    title="Statt „n.b.“ von Hand gesetzt"
                                  >
                                    !
                                  </span>
                                )}
                            </button>
                          </td>
                        );
                      }
                      const { date, kind } = column;
                      const entry = entryMap.get(entryKey(student.id, date));
                      const cancelled = isCancelled(date);
                      const value =
                        kind == "oral"
                          ? entry?.grade
                          : kind == "mark"
                            ? entry?.mark
                            : entry?.projectMark;
                      const isExam = isExamDay(typesOf(date));
                      const retaker = isRetaker(student, date);
                      // Graded on another date of the exam or project, shown faintly
                      const locked = isCellLocked(student, column);
                      const markKind: MarkKind =
                        kind == "projectMark" ? "project" : "exam";
                      const chainMark =
                        locked && kind != "oral"
                          ? chains[markKind]
                              .get(date)!
                              .map(
                                (other) =>
                                  entryMap.get(entryKey(student.id, other))?.[
                                    MARK_FIELD[markKind]
                                  ],
                              )
                              .find((mark) => mark != null)
                          : undefined;
                      // "Excused" belongs to the exam or retake for those writing it
                      const showAbsent =
                        !!entry?.absent &&
                        (kind == "mark"
                          ? isExam || retaker
                          : kind == "oral" && !retaker);
                      return (
                        <td
                          key={getColumnKey(column)}
                          className="h-11 min-w-11 border-r border-b border-line p-0 text-center"
                          style={{
                            background:
                              cancelled || locked
                                ? "var(--color-line)"
                                : CELL_TINTS[rowIndex % 2][columnIndex % 2],
                            // The current lesson's column is framed in the color of its header
                            boxShadow:
                              date == lessonDate ? LESSON_FRAME : undefined,
                          }}
                        >
                          <button
                            type="button"
                            disabled={mode == "view"}
                            aria-label={`${formatStudentName(student)}, ${date}`}
                            aria-disabled={locked || undefined}
                            title={entry?.comment ?? undefined}
                            className={
                              "relative flex h-full min-h-11 w-full items-center justify-center gap-0.5 px-0.5 active:bg-brand-100 " +
                              (locked ? "opacity-60" : "")
                            }
                            onClick={() => handleTap(student, column)}
                          >
                            {kind == "oral" && value != null && (
                              <GradeIcon grade={value} size={26} />
                            )}
                            {kind != "oral" && value != null && (
                              <MarkBadge mark={value} />
                            )}
                            {chainMark != null && (
                              <MarkBadge mark={chainMark} />
                            )}
                            {showAbsent && <GradeIcon size={26} />}
                            {kind == "oral" &&
                              value == null &&
                              !entry?.absent &&
                              grading &&
                              settings.suggestions &&
                              !cancelled &&
                              !locked && (
                                <SuggestedGradeIcon
                                  grade={suggestionFor(student, date)}
                                  size={26}
                                />
                              )}
                            {entry?.comment &&
                              (kind == "oral" || (isExam && kind == "mark")) &&
                              (mode == "comment" ? (
                                <span className="relative ml-0.5 max-w-28 truncate rounded-lg bg-surface px-1.5 py-0.5 text-left text-[10px] leading-tight font-medium text-ink shadow-tile ring-1 ring-brand-200">
                                  {getCommentPreview(entry.comment, 3)}
                                </span>
                              ) : (
                                <span className="absolute right-0 bottom-0 flex text-brand-600">
                                  <CommentIcon size={13} strokeWidth={2.5} />
                                </span>
                              ))}
                          </button>
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>

      <Menu
        anchorEl={exportMenu}
        open={!!exportMenu}
        onClose={() => setExportMenu(null)}
      >
        <MenuItem onClick={() => runExport("pdf")}>Als PDF</MenuItem>
        <MenuItem onClick={() => runExport("csv")}>Als CSV</MenuItem>
      </Menu>

      <Popover
        open={!!typeMenu}
        anchorEl={typeMenu?.anchor}
        onClose={() => setTypeMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <div className="flex flex-col gap-1 p-2">
          {typeMenu &&
            !isCancelled(typeMenu.date) &&
            typesFor(typeMenu.date).map((type) => (
              <Button
                key={type}
                // A second tap removes a type
                variant={
                  typeMenu && typesOf(typeMenu.date).includes(type)
                    ? "contained"
                    : "text"
                }
                onClick={() => {
                  const date = typeMenu!.date;
                  setTypeMenu(null);
                  requestLessonType(
                    date,
                    typesOf(date),
                    type,
                    entries.filter((entry) => entry.date == date),
                  );
                }}
              >
                {LESSON_TYPE_LABELS[type]}
              </Button>
            ))}
          {typeMenu && !isCancelled(typeMenu.date) && <Divider />}
          {(Object.keys(REPORT_LABELS) as ReportKind[]).map((kind) => (
            <Button
              key={kind}
              variant={
                typeMenu && hasReport(typeMenu.date, kind)
                  ? "contained"
                  : "text"
              }
              onClick={() => toggleReport(typeMenu!.date, kind)}
            >
              {REPORT_LABELS[kind]}
            </Button>
          ))}
        </div>
      </Popover>

      {lessonTypeDialog}

      {cancelTarget && (
        <CancelDialog
          date={parseISO(cancelTarget)}
          schoolClass={cls}
          isCancelled={isLessonCancelled(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onChanged={handleLessonChanged}
        />
      )}

      {reportRemoval && (
        <ConfirmDialog
          open
          title={`${REPORT_LABELS[reportRemoval.report.kind]} entfernen?`}
          confirmLabel="Entfernen"
          onClose={() => setReportRemoval(null)}
          onConfirm={async () => {
            await removeReport(cls.id, reportRemoval.report);
            setReportRemoval(null);
            handleLessonChanged();
          }}
        >
          {`Die ${reportRemoval.grades} manuell gesetzten Noten werden gelöscht.`}
        </ConfirmDialog>
      )}

      {commenting && (
        <CommentDialog
          studentName={formatStudentName(commenting.student)}
          initial={
            entryMap.get(entryKey(commenting.student.id, commenting.date))
              ?.comment ?? ""
          }
          onClose={() => setCommenting(null)}
          onSave={async (comment) => {
            setCommenting(null);
            await history.change(
              "Kommentar",
              commenting.student.id,
              commenting.date,
              entryMap.get(entryKey(commenting.student.id, commenting.date)),
              { comment: comment.trim() || null },
              describeCell(commenting.student, commenting.date),
            );
          }}
        />
      )}

      <Snackbar
        open={!!message}
        message={message}
        autoHideDuration={3000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </SpeedDialLayout>
  );
}
