import {
  Button,
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
import { GradeIcon } from "../../components/GradeIcon";
import { GradeToolBar } from "../../components/GradeToolBar";
import {
  CardsIcon,
  CheckIcon,
  ChevronLeftIcon,
  DownloadIcon,
  StarIcon,
  TableIcon,
} from "../../components/icons";
import { LessonTypeBadge } from "../../components/LessonTypeBadge";
import { MarkBadge } from "../../components/MarkBadge";
import { SuggestedGradeIcon } from "../../components/SuggestedGradeIcon";
import type { GradeEntry, SeatedStudent } from "../../db";
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
  getValidGradeTool,
  isEntryComplete,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { LESSON_TYPE_LABELS, lessonKey } from "../../lib/lessons";
import { getOverviewColumns, type OverviewColumn } from "../../lib/overview";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { getVisibleGrades } from "../../lib/settings";
import { FAIL_TOOL, getToolValues } from "../../services/grading";
import { CommentDialog } from "../classroom/CommentDialog";
import { GradeResultsDialog } from "./GradeResultsDialog";
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
  const [trainingNames, setTrainingNames] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [typeMenu, setTypeMenu] = useState<{
    date: string;
    anchor: HTMLElement;
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

  const hasSpecialLessons = dates.some(
    (date) => !isCancelled(date) && typeOf(date) != "normal",
  );
  // A selected mark does not stay active once no lesson takes marks anymore
  const activeTool = getValidGradeTool(
    tool,
    hasSpecialLessons ? "project" : "normal",
    visibleGrades,
    settings.suggestions,
  );
  const columns = getOverviewColumns(dates, typeOf);

  const nameOf = useNicknames ? getStudentLabel : formatStudentName;
  const rows = [...students].sort((a, b) =>
    nameOf(a).localeCompare(nameOf(b), "de"),
  );
  const withPhotos = students.filter((student) => student.image);

  const suggestionFor = (student: SeatedStudent, date: string) =>
    suggestGrade(
      entries.filter((entry) => entry.studentId == student.id),
      date,
      visibleGrades,
    );

  /** Whether a tool can be used in a column; a project's two columns take different ones. */
  const fitsColumn = ({ date, kind }: OverviewColumn) => {
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

  const handleTap = async (student: SeatedStudent, column: OverviewColumn) => {
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

  const runExport = async (format: "csv" | "pdf") => {
    setExportMenu(null);
    const data = {
      schoolClass: cls,
      title: `${formatClassName(cls)} ${cls.subject}, ${formatSchoolYear(cls.year)}, ${SCHOOL_YEAR_PART_LABELS[cls.part]}`,
      students: rows.map((student) => ({
        id: student.id,
        name: nameOf(student),
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
          hideMarks={!hasSpecialLessons}
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
            variant="outlined"
            startIcon={<TableIcon size={18} />}
            onClick={() => setShowResults(true)}
          >
            Noten
          </Button>
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

      <main className="card min-h-0 flex-1 overflow-auto">
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
                {columns.map(({ date, kind }, index) => (
                  <DateHeader
                    key={`${date}-${kind}`}
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
                ))}
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
                    {nameOf(student)}
                  </th>
                  {columns.map((column, columnIndex) => {
                    const { date, kind } = column;
                    const entry = entryMap.get(entryKey(student.id, date));
                    const cancelled = isCancelled(date);
                    const value = kind == "oral" ? entry?.grade : entry?.mark;
                    const isExam = typeOf(date) == "exam";
                    const showAbsent =
                      !!entry?.absent && (kind == "oral" || isExam);
                    return (
                      <td
                        key={`${date}-${kind}`}
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
          {(Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map((type) => (
            <Button
              key={type}
              variant={
                typeMenu && typeOf(typeMenu.date) == type ? "contained" : "text"
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

      {showResults && (
        <GradeResultsDialog
          students={rows}
          entries={entries}
          dates={dates.filter((date) => !isCancelled(date))}
          nameOf={nameOf}
          typeOf={typeOf}
          onClose={() => setShowResults(false)}
        />
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
