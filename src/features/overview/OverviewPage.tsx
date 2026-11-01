import {
  Button,
  Divider,
  Menu,
  MenuItem,
  Popover,
  Snackbar,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import {
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { CancelDialog } from "../../components/CancelDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GradeIcon } from "../../components/GradeIcon";
import { GradeToolBar } from "../../components/GradeToolBar";
import {
  CardsIcon,
  CheckIcon,
  ChevronLeftIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  StarIcon,
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
import { useGradingHistory } from "../../hooks/useGradingHistory";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import { useLongPress } from "../../hooks/useLongPress";
import { useSettings } from "../../hooks/useSettings";
import { useStoredBoolean } from "../../hooks/useStoredBoolean";
import { suggestGrade } from "../../lib/assessment";
import {
  formatClassName,
  formatSchoolYear,
  formatStudentName,
  getStudentLabel,
} from "../../lib/formatters";
import {
  DEFAULT_GRADE_TOOL,
  getToolValue,
  getValidGradeTool,
  isEntryComplete,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { LESSON_TYPE_LABELS, lessonKey } from "../../lib/lessons";
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
import { FAIL_TOOL, getToolValues } from "../../services/grading";
import { CommentDialog } from "../classroom/CommentDialog";
import { NameTrainerDialog } from "./NameTrainerDialog";
import type { OverviewLoaderData } from "./overviewLoader";

const entryKey = (studentId: number, date: string) => `${studentId}|${date}`;

/** Cell tints like a soft checkerboard: the row picks the hue, the column the strength. */
const CELL_TINTS = [
  ["var(--color-brand-50)", "var(--color-brand-100)"],
  ["var(--color-blush-50)", "var(--color-blush-100)"],
];

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
  lessonType: LessonType;
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
  lessonType,
  onTap,
  onLongPress,
}: DateHeaderProps) {
  const pressHandlers = useLongPress(onLongPress);
  return (
    <th
      className="sticky top-0 h-24 min-w-11 border-b border-line bg-surface"
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
            : HEADER_TINTS[index % 2],
        }}
      />
      {/* Rotates around its vertical center, placed on the band's center line, which keeps
          the date, with or without marker, at an equal distance from both band edges */}
      <span
        className={
          "absolute bottom-2.5 flex origin-left flex-col items-start gap-0.5 text-xs font-medium whitespace-nowrap " +
          (isCancelled ? "text-muted line-through" : "")
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
        <LessonTypeBadge type={lessonType} />
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
  } = useLoaderData<OverviewLoaderData>();
  const settings = useSettings();
  const visibleGrades = getVisibleGrades(settings);
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const [grading, setGrading] = useState(false);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [useNicknames, setUseNicknames] = useStoredBoolean(
    "overviewNicknames",
    false,
  );
  const [showPhotos, setShowPhotos] = useStoredBoolean("overviewPhotos", true);
  const [showTraitNames, setShowTraitNames] = useStoredBoolean(
    "overviewTraitNames",
    false,
  );
  const [trainingNames, setTrainingNames] = useState(false);
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
  const history = useGradingHistory(cls.id, revalidate);
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
  const lessonDate = searchParams.get("date");
  const typeOf = (date: string): LessonType =>
    lessonTypes[lessonKey(cls.id, date)] ?? "normal";
  const isLessonCancelled = (date: string) =>
    lessons.includes(lessonKey(cls.id, date));
  const isCancelled = (date: string) =>
    days.includes(date) || isLessonCancelled(date);
  const isComplete = (date: string) =>
    students.length > 0 &&
    students.every((student) =>
      isEntryComplete(entryMap.get(entryKey(student.id, date)), typeOf(date)),
    );

  const hasMarkColumns =
    reports.length > 0 ||
    dates.some((date) => !isCancelled(date) && typeOf(date) != "normal");
  // A selected mark does not stay active once no lesson takes marks anymore
  const activeTool = getValidGradeTool(
    tool,
    hasMarkColumns ? "project" : "normal",
    visibleGrades,
    settings.suggestions,
  );
  const columns = getOverviewColumns(
    dates,
    typeOf,
    getReportColumns(
      reports,
      reportGrades,
      students.map((student) => student.id),
      entries,
      typeOf,
      settings,
    ),
  );

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

  /** Whether a tool can be used in a column; a project's two columns take different ones. */
  const fitsColumn = ({ date, kind }: LessonColumn) => {
    if (isCancelled(date))
      return activeTool == FAIL_TOOL || activeTool == "erase";
    const isMarkTool =
      activeTool.startsWith("mark:") || activeTool == "eraseMark";
    return (
      activeTool == "comment" ||
      typeOf(date) != "project" ||
      (kind == "mark") == isMarkTool
    );
  };

  const handleTap = async (student: SeatedStudent, column: LessonColumn) => {
    const { date } = column;
    if (!fitsColumn(column)) {
      setMessage(
        isCancelled(date)
          ? "Bei Ausfall kann nur die 6 vergeben oder gelöscht werden."
          : "Dieses Werkzeug passt nicht zu dieser Spalte.",
      );
      return;
    }
    if (activeTool == "comment") return setCommenting({ student, date });
    const entry = entryMap.get(entryKey(student.id, date));
    if (activeTool == "suggestion" && (entry?.grade != null || entry?.absent)) {
      return;
    }
    const type = typeOf(date);
    const values = getToolValues(
      activeTool == "suggestion"
        ? `grade:${suggestionFor(student, date)}`
        : activeTool,
      type,
    );
    if (values) await history.change(student.id, date, entry, values);
    else {
      setMessage(
        `Dieses Werkzeug passt nicht zu dieser Stunde (${LESSON_TYPE_LABELS[type]}).`,
      );
    }
  };

  /** Tap on a report's grade: marks replace the calculated grade, erasing brings it back. */
  const handleReportTap = async (
    student: SeatedStudent,
    { date, report: kind }: ReportColumn,
  ) => {
    if (!activeTool.startsWith("mark:") && activeTool != "eraseMark") {
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
      activeTool == "eraseMark" ? null : getToolValue(activeTool),
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
      typeOf,
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

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {grading ? (
        <GradeToolBar
          tool={activeTool}
          onChange={setTool}
          onExit={() => {
            history.reset();
            setGrading(false);
          }}
          history={history}
          hideMarks={!hasMarkColumns}
        />
      ) : (
        <header className="flex flex-wrap items-center gap-3">
          <Button
            component={Link}
            to={
              lessonDate ? `/classes/${cls.id}?date=${lessonDate}` : "/overview"
            }
            startIcon={<ChevronLeftIcon />}
            className="pl-2"
          >
            {lessonDate ? "Zur Stunde" : "Alle Klassen"}
          </Button>
          <div className="mx-auto text-center">
            <div className="text-xl font-bold tracking-tight">
              {formatClassName(cls)} · {cls.subject}
            </div>
            <div className="text-sm text-muted">
              {formatSchoolYear(cls.year)} · {SCHOOL_YEAR_PART_LABELS[cls.part]}
            </div>
          </div>
          <FormControlLabel
            className="mr-0"
            label="Spitznamen"
            control={
              <Switch
                checked={useNicknames}
                onChange={(event) => setUseNicknames(event.target.checked)}
              />
            }
          />
          {withPhotos.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<CardsIcon size={18} />}
              onClick={() => setTrainingNames(true)}
              className="whitespace-nowrap"
            >
              Namen lernen
            </Button>
          )}
          <Button
            variant="contained"
            disabled={dates.length == 0}
            startIcon={<StarIcon size={18} />}
            onClick={() => setGrading(true)}
            className="whitespace-nowrap"
          >
            Bewerten
          </Button>
        </header>
      )}

      <div className="relative min-h-0 flex-1">
        <main className="card h-full overflow-auto pb-10">
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
                    return (
                      <DateHeader
                        key={getColumnKey(column)}
                        date={date}
                        index={index}
                        columns={columns.length}
                        isComplete={isComplete(date)}
                        isCancelled={isCancelled(date)}
                        lessonType={
                          // A project's marker belongs to its column of marks
                          kind == "oral" && typeOf(date) == "project"
                            ? "normal"
                            : typeOf(date)
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
                      className="sticky left-0 z-10 border-r border-b border-line px-3 py-1 text-left font-semibold whitespace-nowrap"
                      style={{ background: CELL_TINTS[rowIndex % 2][1] }}
                    >
                      <div className="flex items-center gap-2">
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
                            {!showTraitNames &&
                              traitsOf(student).map((trait) => (
                                <span
                                  key={trait.id}
                                  title={trait.name}
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ background: trait.color }}
                                />
                              ))}
                          </div>
                          {showTraitNames && traitsOf(student).length > 0 && (
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
                      </div>
                    </th>
                    {columns.map((column, columnIndex) => {
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
                            </button>
                          </td>
                        );
                      }
                      const { date, kind } = column;
                      const entry = entryMap.get(entryKey(student.id, date));
                      const cancelled = isCancelled(date);
                      const value = kind == "oral" ? entry?.grade : entry?.mark;
                      const isExam = typeOf(date) == "exam";
                      const showAbsent =
                        !!entry?.absent && (kind == "oral" || isExam);
                      return (
                        <td
                          key={getColumnKey(column)}
                          className="h-11 min-w-11 border-r border-b border-line p-0 text-center"
                          style={{
                            background: cancelled
                              ? "var(--color-line)"
                              : CELL_TINTS[rowIndex % 2][columnIndex % 2],
                          }}
                        >
                          <button
                            type="button"
                            disabled={!grading}
                            aria-label={`${formatStudentName(student)}, ${date}`}
                            title={entry?.comment ?? undefined}
                            className="relative flex h-full min-h-11 w-full items-center justify-center gap-0.5 px-0.5 active:bg-brand-100"
                            onClick={() => handleTap(student, column)}
                          >
                            {kind == "oral" && value != null && (
                              <GradeIcon grade={value} size={26} />
                            )}
                            {kind == "mark" && value != null && (
                              <MarkBadge mark={value} />
                            )}
                            {showAbsent && <GradeIcon size={26} />}
                            {kind == "oral" &&
                              value == null &&
                              !entry?.absent &&
                              grading &&
                              settings.suggestions &&
                              !cancelled && (
                                <SuggestedGradeIcon
                                  grade={suggestionFor(student, date)}
                                  size={26}
                                />
                              )}
                            {entry?.comment && (kind == "oral" || isExam) && (
                              <span className="absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full bg-brand-500" />
                            )}
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
        {hasTraits && (
          <Button
            startIcon={<InfoIcon size={18} />}
            onClick={() => setShowTraitNames(!showTraitNames)}
            className="absolute -bottom-2 -left-2 z-50 bg-brand-100 opacity-75 shadow-tile"
          >
            {showTraitNames ? "Nur Farbpunkte" : "Eigenschaften anzeigen"}
          </Button>
        )}
        {withPhotos.length > 0 && (
          <Button
            startIcon={
              showPhotos ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />
            }
            onClick={() => setShowPhotos(!showPhotos)}
            className="absolute -right-2 -bottom-2 z-50 bg-brand-100 opacity-75 shadow-tile"
          >
            {showPhotos ? "Bilder ausblenden" : "Bilder einblenden"}
          </Button>
        )}
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
            (Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map((type) => (
              <Button
                key={type}
                variant={
                  typeMenu && typeOf(typeMenu.date) == type
                    ? "contained"
                    : "text"
                }
                onClick={() => {
                  const date = typeMenu!.date;
                  setTypeMenu(null);
                  requestLessonType(
                    date,
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

      {trainingNames && (
        <NameTrainerDialog
          students={withPhotos}
          onClose={() => setTrainingNames(false)}
        />
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
              commenting.student.id,
              commenting.date,
              entryMap.get(entryKey(commenting.student.id, commenting.date)),
              { comment: comment.trim() || null },
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
    </div>
  );
}
