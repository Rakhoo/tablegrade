import {
  Button,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import {
  Link,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  clearLesson,
  deleteSchoolClass,
  moveStudentSeat,
  saveSchoolClass,
  setComment,
  setGrade,
  setWarnings,
  type SeatedStudent,
} from "../../db";
import { GradeIcon } from "../../components/GradeIcon";
import { GradeToolBar } from "../../components/GradeToolBar";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  TableIcon,
  TrashIcon,
} from "../../components/icons";
import { DEFAULT_GRADE_TOOL, type GradeTool } from "../../lib/grades";
import { useStoredBoolean } from "../../hooks/useStoredBoolean";
import { formatClassName, formatStudentName } from "../../lib/formatters";
import type { Lesson } from "../../lib/lessons";
import { getClassColor } from "../../lib/subjectColors";
import { nextWarningLevel, WARNING_LEVELS } from "../../lib/warnings";
import { ClassEditDialog } from "./ClassEditDialog";
import type { ClassroomLoaderData } from "./classroomLoader";
import { ClearLessonDialog } from "./ClearLessonDialog";
import { CommentDialog } from "./CommentDialog";
import { SeatGrid } from "./SeatGrid";
import { TraitsMenu } from "./TraitsMenu";
import "./ClassroomPage.css";

/** Interaction mode of the seating plan. */
type ClassroomMode = "warn" | "grade" | "arrange";

/** Classroom page: seating plan for grading one lesson, warning, arranging seats and editing. */
export function ClassroomPage() {
  const {
    class: cls,
    students,
    grades,
    date,
    editing,
    allClasses,
    subjects,
    holidays,
    traits,
    previous,
    next,
  } = useLoaderData<ClassroomLoaderData>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { revalidate } = useRevalidator();
  const [mode, setMode] = useState<ClassroomMode>("warn");
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showTraits, setShowTraits] = useStoredBoolean("showTraits", true);
  const [commenting, setCommenting] = useState<SeatedStudent | null>(null);

  const gradeMap = new Map(grades.map((entry) => [entry.studentId, entry]));
  const lessonDate = parseISO(date);
  const lessonLink = (lesson: Lesson) =>
    `/classes/${lesson.id}?date=${lesson.date}`;

  /** Leaves the edit dialog, preferring browser history so "back" keeps working. */
  const leave = (fallback: string) => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  const accent = cls ? getClassColor(cls).accent : undefined;
  const isComplete =
    students.length > 0 &&
    students.every((student) => gradeMap.get(student.id)?.grade);

  /** Applies the current mode (and grading tool) to a tapped student. */
  const handleTap = async (student: SeatedStudent) => {
    const entry = gradeMap.get(student.id);
    if (mode == "warn") {
      await setWarnings(
        cls!.id,
        student.id,
        date,
        nextWarningLevel(entry?.warnings ?? 0),
      );
    } else if (tool == "comment") {
      return setCommenting(student);
    } else {
      await setGrade(cls!.id, student.id, date, tool == "erase" ? null : tool);
    }
    revalidate();
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {mode == "grade" ? (
        <GradeToolBar
          tool={tool}
          onChange={setTool}
          onExit={() => setMode("warn")}
        />
      ) : (
        <>
          {/* Equal outer columns keep the title centered above the mode explanation */}
          <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <Button
              component={Link}
              to={`/timetable?date=${date}`}
              startIcon={<ChevronLeftIcon />}
              className="justify-self-start pl-2"
            >
              Stundenplan
            </Button>

            <div className="flex items-center gap-3">
              {cls && (
                <IconButton
                  component={Link}
                  to={previous ? lessonLink(previous) : ""}
                  replace
                  disabled={!previous}
                  aria-label="Vorherige Stunde"
                  className="bg-surface shadow-tile disabled:opacity-40"
                >
                  <ChevronLeftIcon />
                </IconButton>
              )}
              <div className="min-w-56 text-center">
                <div className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight">
                  {accent && (
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: accent }}
                    />
                  )}
                  {cls
                    ? `${formatClassName(cls)} · ${cls.subject}`
                    : "Neue Klasse"}
                  {isComplete && (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                      style={{ background: "#15803d" }}
                      aria-label="Vollständig bewertet"
                    >
                      <CheckIcon size={15} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted">
                  {format(lessonDate, "EEEE, d. MMMM yyyy", { locale: de })}
                </div>
              </div>
              {cls && (
                <IconButton
                  component={Link}
                  to={next ? lessonLink(next) : ""}
                  replace
                  disabled={!next}
                  aria-label="Nächste Stunde"
                  className="bg-surface shadow-tile disabled:opacity-40"
                >
                  <ChevronRightIcon />
                </IconButton>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              {cls && (
                <Button
                  variant="outlined"
                  component={Link}
                  to={`/evaluations/${cls.id}?date=${date}`}
                  aria-label="Auswertung"
                  startIcon={<TableIcon size={18} />}
                  className="portrait:min-w-0 portrait:px-3 portrait:[&_.MuiButton-startIcon]:m-0"
                >
                  <span className="portrait:hidden">Auswertung</span>
                </Button>
              )}
              {cls && (
                <Button
                  variant="contained"
                  component={Link}
                  to={`/classes/${cls.id}/edit?date=${date}`}
                  startIcon={<PencilIcon size={18} />}
                >
                  Bearbeiten
                </Button>
              )}
            </div>
          </header>

          {/* Fixed columns, so switching modes never shifts the controls. Landscape: reset | tool | mode;
          portrait: reset | mode in one row, the tool centered below */}
          <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-3 portrait:grid-cols-2">
            <div className="col-start-1 row-start-1">
              {cls && (
                <Button
                  color="error"
                  disabled={grades.length == 0}
                  onClick={() => setConfirmClear(true)}
                  startIcon={<TrashIcon size={18} />}
                >
                  Stunde zurücksetzen
                </Button>
              )}
            </div>
            <div className="flex h-11 items-center justify-center landscape:col-start-2 landscape:row-start-1 portrait:col-span-2 portrait:row-start-2">
              {mode == "warn" && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  Antippen:
                  {WARNING_LEVELS.map((level, index) => (
                    <span
                      key={index}
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={{
                        background: level?.background ?? "white",
                        color: level?.accent ?? "var(--color-muted)",
                      }}
                    >
                      {level?.label ?? "Zurücksetzen"}
                    </span>
                  ))}
                </div>
              )}
              {mode == "arrange" && (
                <span className="text-sm text-muted">
                  Schüler zum Verschieben auf einen Platz ziehen
                </span>
              )}
            </div>
            <div className="row-start-1 flex items-center justify-end gap-2 landscape:col-start-3 portrait:col-start-2">
              {cls && (
                <Button
                  variant="contained"
                  startIcon={<GradeIcon grade={DEFAULT_GRADE_TOOL} size={20} />}
                  onClick={() => setMode("grade")}
                >
                  Bewertung starten
                </Button>
              )}
              <ToggleButtonGroup
                exclusive
                size="small"
                color="primary"
                value={mode}
                onChange={(_, value: ClassroomMode | null) =>
                  value && setMode(value)
                }
                className="rounded-full bg-surface p-1 shadow-tile"
              >
                <ToggleButton value="warn" className="toggle-pill">
                  Ermahnung
                </ToggleButton>
                <ToggleButton value="arrange" className="toggle-pill">
                  Anordnen
                </ToggleButton>
              </ToggleButtonGroup>
            </div>
          </div>
        </>
      )}

      <main className="card relative min-h-0 flex-1 bg-brand-400 p-2">
        {cls && students.length == 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white/80">
            <span className="text-lg font-semibold text-white">
              Noch keine Schüler
            </span>
            Über „Bearbeiten“ lässt sich die Schülerliste anlegen.
          </div>
        )}
        <SeatGrid
          students={students}
          traits={showTraits ? traits : []}
          grades={gradeMap}
          arranging={mode == "arrange"}
          onTap={handleTap}
          onMove={async (student, x, y) => {
            await moveStudentSeat(cls!.id, student.id, x, y);
            revalidate();
          }}
        />
        {students.some((student) => student.traitIds.length > 0) && (
          <div className="absolute -bottom-2 -left-2 z-20">
            <TraitsMenu
              traits={traits}
              students={students}
              visible={showTraits}
              onVisibleChange={setShowTraits}
            />
          </div>
        )}
      </main>

      {confirmClear && (
        <ClearLessonDialog
          entries={grades}
          dateLabel={format(lessonDate, "EEEE, d. MMMM yyyy", { locale: de })}
          onClose={() => setConfirmClear(false)}
          onConfirm={async (parts) => {
            await clearLesson(cls!.id, date, parts);
            revalidate();
          }}
        />
      )}

      {commenting && (
        <CommentDialog
          studentName={formatStudentName(commenting)}
          initial={gradeMap.get(commenting.id)?.comment ?? ""}
          onClose={() => setCommenting(null)}
          onSave={async (comment) => {
            setCommenting(null);
            await setComment(cls!.id, commenting.id, date, comment);
            revalidate();
          }}
        />
      )}

      {editing && (
        <ClassEditDialog
          cls={cls}
          students={students}
          allClasses={allClasses}
          subjects={subjects}
          holidays={holidays}
          traits={traits}
          preset={{
            day: Number(searchParams.get("day")) || undefined,
            hour: Number(searchParams.get("hour")) || undefined,
            date: lessonDate,
          }}
          onCancel={() =>
            leave(cls ? `/classes/${cls.id}?date=${date}` : "/timetable")
          }
          onDelete={async () => {
            await deleteSchoolClass(cls!.id);
            navigate(`/timetable?date=${date}`, { replace: true });
          }}
          onSave={async (form, roster) => {
            const id = await saveSchoolClass({ ...form, id: cls?.id }, roster);
            if (cls) return leave(`/classes/${id}?date=${date}`);
            // Keep the lesson date from the timetable only if it fits the chosen weekday
            const keepDate =
              searchParams.has("date") &&
              (lessonDate.getDay() == form.day ||
                lessonDate.getDay() == form.day2);
            navigate(`/classes/${id}${keepDate ? `?date=${date}` : ""}`, {
              replace: true,
            });
          }}
        />
      )}
    </div>
  );
}
