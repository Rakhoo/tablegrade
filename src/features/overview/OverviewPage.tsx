import {
  Button,
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
  StarIcon,
} from "../../components/icons";
import { LessonTypeBadge } from "../../components/LessonTypeBadge";
import { MarkBadge } from "../../components/MarkBadge";
import { setComment, type GradeEntry, type SeatedStudent } from "../../db";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import { useLongPress } from "../../hooks/useLongPress";
import { useStoredBoolean } from "../../hooks/useStoredBoolean";
import {
  formatClassName,
  formatSchoolYear,
  formatStudentName,
  getStudentLabel,
} from "../../lib/formatters";
import {
  DEFAULT_GRADE_TOOL,
  getGradeDefinition,
  getValidGradeTool,
  isEntryComplete,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { LESSON_TYPE_LABELS, lessonKey } from "../../lib/lessons";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { applyGradeTool } from "../../services/grading";
import { CommentDialog } from "../classroom/CommentDialog";
import { NameTrainerDialog } from "./NameTrainerDialog";
import type { OverviewLoaderData } from "./overviewLoader";

const entryKey = (studentId: number, date: string) => `${studentId}|${date}`;

/** Cell tints like a soft checkerboard: the row picks the hue, the column the strength. */
const CELL_TINTS = [
  ["#fbf9ff", "#f1ecff"],
  ["#fff6fa", "#fde8f1"],
];

/** Header tints per column, matching the strength of the names in the first column. */
const HEADER_TINTS = ["#f5f0ff", "#e9e1ff"];

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
            ? "var(--color-gray-100)"
            : HEADER_TINTS[index % 2],
        }}
      />
      {/* Rotates around its vertical center, placed on the band's center line, which keeps
          the date, with or without marker, at an equal distance from both band edges */}
      <span
        className={
          "absolute bottom-2.5 flex origin-left flex-col items-start gap-0.5 text-xs font-medium whitespace-nowrap " +
          (isCancelled ? "text-gray-400 line-through" : "")
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
    lessons,
    lessonTypes,
  } = useLoaderData<OverviewLoaderData>();
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const [grading, setGrading] = useState(false);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [useNicknames, setUseNicknames] = useStoredBoolean(
    "overviewNicknames",
    false,
  );
  const [trainingNames, setTrainingNames] = useState(false);
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
  const { requestLessonType, lessonTypeDialog } = useLessonTypeChange(
    cls.id,
    revalidate,
  );

  const entryMap = new Map<string, GradeEntry>(
    entries.map((entry) => [entryKey(entry.studentId, entry.date), entry]),
  );
  const lessonDate = searchParams.get("date");
  const typeOf = (date: string): LessonType =>
    lessonTypes[lessonKey(cls.id, date)] ?? "normal";
  const isCancelled = (date: string) =>
    lessons.includes(lessonKey(cls.id, date));
  const isComplete = (date: string) =>
    students.length > 0 &&
    students.every((student) =>
      isEntryComplete(entryMap.get(entryKey(student.id, date)), typeOf(date)),
    );

  const hasSpecialLessons = dates.some(
    (date) => !isCancelled(date) && typeOf(date) != "normal",
  );
  // A selected mark does not stay active once no lesson takes marks anymore
  const activeTool = hasSpecialLessons
    ? tool
    : getValidGradeTool(tool, "normal");

  const nameOf = useNicknames ? getStudentLabel : formatStudentName;
  const rows = [...students].sort((a, b) =>
    nameOf(a).localeCompare(nameOf(b), "de"),
  );
  const withPhotos = students.filter((student) => student.image);

  const handleTap = async (student: SeatedStudent, date: string) => {
    if (activeTool == "comment") return setCommenting({ student, date });
    const type = typeOf(date);
    if (await applyGradeTool(activeTool, type, cls.id, student.id, date)) {
      revalidate();
    } else {
      setMessage(
        `Dieses Werkzeug passt nicht zu dieser Stunde (${LESSON_TYPE_LABELS[type]}).`,
      );
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {grading ? (
        <GradeToolBar
          tool={activeTool}
          onChange={setTool}
          onExit={() => setGrading(false)}
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
                <th className="sticky top-0 left-0 z-40 bg-surface" />
                {dates.map((date, index) => (
                  <DateHeader
                    key={date}
                    date={date}
                    index={index}
                    columns={dates.length}
                    isComplete={isComplete(date)}
                    isCancelled={isCancelled(date)}
                    lessonType={typeOf(date)}
                    onTap={
                      isCancelled(date)
                        ? undefined
                        : (anchor) => setTypeMenu({ date, anchor })
                    }
                    onLongPress={() => setCancelTarget(date)}
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
                  {dates.map((date, columnIndex) => {
                    const entry = entryMap.get(entryKey(student.id, date));
                    const grade = getGradeDefinition(entry?.grade);
                    const cancelled = isCancelled(date);
                    return (
                      <td
                        key={date}
                        className="h-11 min-w-11 border-r border-b border-line p-0 text-center"
                        style={{
                          background: cancelled
                            ? "var(--color-gray-100)"
                            : CELL_TINTS[rowIndex % 2][columnIndex % 2],
                        }}
                      >
                        <button
                          type="button"
                          disabled={!grading || cancelled}
                          aria-label={`${formatStudentName(student)}, ${date}`}
                          title={entry?.comment ?? undefined}
                          className="relative flex h-full min-h-11 w-full items-center justify-center gap-0.5 px-0.5 active:bg-brand-100"
                          onClick={() => handleTap(student, date)}
                        >
                          {grade && <GradeIcon grade={grade.key} size={26} />}
                          {entry?.mark && <MarkBadge mark={entry.mark} />}
                          {entry?.comment && (
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
          isCancelled={isCancelled(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onChanged={revalidate}
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
            await setComment(
              cls.id,
              commenting.student.id,
              commenting.date,
              comment,
            );
            revalidate();
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
