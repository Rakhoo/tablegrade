import { Button, IconButton } from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { clearLesson, type SeatedStudent } from "../../db";
import { BackButton } from "../../components/BackButton";
import { GradeToolBar } from "../../components/GradeToolBar";
import { HistoryButtons } from "../../components/HistoryButtons";
import { LessonTypeBadge } from "../../components/LessonTypeBadge";
import { ModeBar, ModeToggle } from "../../components/ModeBar";
import {
  SpeedDialLayout,
  type SpeedDialEntry,
  type SpeedDialLink,
} from "../../components/SpeedDial";
import {
  CardsIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  InfoIcon,
  PencilIcon,
  TableIcon,
  TagIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ImageOffIcon,
  TagOffIcon,
} from "../../components/icons";
import { useEditHistory } from "../../hooks/useEditHistory";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import {
  DEFAULT_GRADE_TOOL,
  getValidGradeTool,
  isEntryComplete,
  type GradeTool,
} from "../../lib/grades";
import { describeValues, getToolValues } from "../../services/grading";
import { useSettings } from "../../hooks/useSettings";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { getVisibleGrades, type ClassroomMode } from "../../lib/settings";
import { suggestGrade } from "../../lib/assessment";
import { formatClassName, formatStudentName } from "../../lib/formatters";
import type { Lesson } from "../../lib/lessons";
import { getZoomedArea } from "../../lib/seating";
import { getClassColor } from "../../lib/subjectColors";
import { nextWarningLevel, WARNING_LEVELS } from "../../lib/warnings";
import type { ClassroomLoaderData } from "./classroomLoader";
import { ClearLessonDialog } from "./ClearLessonDialog";
import { CommentDialog } from "./CommentDialog";
import { SeatGrid } from "./SeatGrid";
import { TraitsLegend } from "./TraitsLegend";
import "./ClassroomPage.css";

/** The modes of the seating plan with their explanations. */
const MODES: {
  mode: ClassroomMode;
  label: string;
  help: string;
  /** What a tap on the seating plan does in this mode. */
  gridHelp: string;
}[] = [
  {
    mode: "warn",
    label: "Ermahnen",
    help: "Modus Ermahnen: Antippen eines Schülers ermahnt ihn.",
    gridHelp:
      "Antippen ermahnt einen Schüler, erneutes Antippen verhängt eine Maßnahme, ein drittes nimmt beides zurück.",
  },
  {
    mode: "grade",
    label: "Bewerten",
    help: "Modus Bewerten: Symbole oder Noten für diese Stunde vergeben.",
    gridHelp:
      "Antippen vergibt das oben gewählte Werkzeug. Gestrichelte Symbole sind Vorschläge aus den bisherigen Bewertungen.",
  },
  {
    mode: "comment",
    label: "Kommentieren",
    help: "Modus Kommentieren: Kommentare zu dieser Stunde lesen und schreiben.",
    gridHelp:
      "Sprechblasen zeigen den Anfang der Kommentare. Antippen öffnet den Kommentar zum Bearbeiten oder legt einen neuen an.",
  },
  {
    mode: "arrange",
    label: "Anordnen",
    help: "Modus Anordnen: die Sitzordnung ändern.",
    gridHelp:
      "Schüler auf einen ganzen oder halben Platz ziehen. Auf einem anderen Schüler tauschen beide die Plätze.",
  },
];

/**
 * Classroom page: seating plan of one lesson for warning, grading, commenting and arranging
 * seats; the other features are in the speed dial.
 */
export function ClassroomPage() {
  const {
    class: cls,
    students,
    roster,
    grades,
    classGrades,
    date,
    traits,
    lessonType,
    previous,
    next,
  } = useLoaderData<ClassroomLoaderData>();
  const { revalidate } = useRevalidator();
  const settings = useSettings();
  const [mode, setMode] = useState<ClassroomMode>(settings.startMode);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showTraits, setShowTraits] = useDisplayOption("traits");
  const [showPhotos, setShowPhotos] = useDisplayOption("photos");
  const [zoomed, setZoomed] = useDisplayOption("zoom");
  const [traitsAnchor, setTraitsAnchor] = useState<HTMLElement | null>(null);
  const [commenting, setCommenting] = useState<SeatedStudent | null>(null);

  const gradeMap = new Map(grades.map((entry) => [entry.studentId, entry]));
  const lessonDate = parseISO(date);
  const lessonLink = (lesson: Lesson) =>
    `/classes/${lesson.id}?date=${lesson.date}`;

  const history = useEditHistory(
    cls.id,
    {
      key: `classes/${cls.id}/${date}`,
      url: `/classes/${cls.id}?date=${date}`,
      label: `Sitzplan ${format(lessonDate, "dd.MM.")}`,
    },
    revalidate,
  );

  const accent = getClassColor(cls, settings.levels).accent;
  const isComplete =
    students.length > 0 &&
    students.every((student) =>
      isEntryComplete(gradeMap.get(student.id), lessonType),
    );
  const visibleGrades = getVisibleGrades(settings);
  const activeTool = getValidGradeTool(
    tool,
    lessonType,
    visibleGrades,
    settings.suggestions,
  );
  // While grading, students without a symbol show what their previous ones suggest
  const suggestions = new Map<number, number>(
    mode == "grade" && lessonType != "exam" && settings.suggestions
      ? students
          .filter((student) => {
            const entry = gradeMap.get(student.id);
            return entry?.grade == null && !entry?.absent;
          })
          .map((student) => [
            student.id,
            suggestGrade(
              classGrades.filter((entry) => entry.studentId == student.id),
              date,
              visibleGrades,
            ),
          ])
      : [],
  );
  const { requestLessonType, lessonTypeDialog } = useLessonTypeChange(
    cls.id,
    () => {
      history.reset();
      revalidate();
    },
  );

  /** Applies the current mode (and grading tool) to a tapped student. */
  const handleTap = async (student: SeatedStudent) => {
    const entry = gradeMap.get(student.id);
    if (mode == "warn") {
      const warnings = entry?.warnings ?? 0;
      await history.changeWarnings(
        student.id,
        date,
        warnings,
        nextWarningLevel(warnings),
        `${formatStudentName(student)}: ${WARNING_LEVELS[nextWarningLevel(warnings)]?.label ?? "Normal"}`,
      );
    } else if (mode == "comment") {
      setCommenting(student);
    } else if (mode == "grade") {
      const suggestion = suggestions.get(student.id);
      const tool: GradeTool | null =
        activeTool != "suggestion"
          ? activeTool
          : suggestion == null
            ? null
            : `grade:${suggestion}`;
      const values = tool && getToolValues(tool, lessonType);
      if (values) {
        await history.change(
          "Bewertung",
          student.id,
          date,
          entry,
          values,
          `${formatStudentName(student)}: ${describeValues(values)}`,
        );
      }
    }
  };

  const currentMode = MODES.find((option) => option.mode == mode)!;
  const viewLink = (path: string) => `/classes/${cls.id}${path}?date=${date}`;
  // Arranging needs the whole room, so it is never zoomed
  const canZoom =
    mode != "arrange" &&
    getZoomedArea(
      students.flatMap(({ x, y }) =>
        x != null && y != null ? [{ x, y }] : [],
      ),
    ) != null;
  const hasPhotos = students.some((student) => student.image);
  const hasTraits = students.some((student) => student.traitIds.length > 0);
  const overviewLink: SpeedDialLink = {
    key: "overview",
    label: "Übersicht",
    icon: <TableIcon />,
    help: "Übersichtstabelle der Klasse mit allen Stunden und Noten.",
    to: `/overview/${cls.id}?date=${date}`,
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
    disabled: !hasPhotos,
    to: viewLink("/names"),
  };
  const planEntries: SpeedDialEntry[] = [editEntry, namesEntry];
  planEntries.push("divider", {
    key: "clear",
    label: "Stunde zurücksetzen",
    icon: <TrashIcon />,
    danger: true,
    help: "Löscht ausgewählte Einträge dieser Stunde: Ermahnungen, Bewertungen oder Kommentare.",
    disabled: grades.length == 0,
    onClick: () => setConfirmClear(true),
  });
  if (hasPhotos || hasTraits || canZoom) planEntries.push("divider");
  if (canZoom) {
    planEntries.push({
      key: "zoom",
      label: "Zoom",
      icon: <ZoomInIcon />,
      offIcon: <ZoomOutIcon />,
      checked: zoomed,
      help: "Zeigt nur den Teil des Raums, in dem Schüler sitzen, so groß wie möglich.",
      onClick: () => setZoomed(!zoomed),
    });
  }
  if (hasPhotos) {
    planEntries.push({
      key: "photos",
      label: "Bilder",
      icon: <ImageIcon />,
      offIcon: <ImageOffIcon />,
      checked: showPhotos,
      help: "Zeigt die Fotos der Schüler im Sitzplan.",
      onClick: () => setShowPhotos(!showPhotos),
    });
  }
  if (hasTraits) {
    planEntries.push({
      key: "traits",
      label: "Eigenschaften",
      icon: <TagIcon />,
      offIcon: <TagOffIcon />,
      checked: showTraits,
      help: "Zeigt die Eigenschaften als farbige Punkte um die Fotos.",
      onClick: () => setShowTraits(!showTraits),
    });
  }
  const modes = (
    <ModeToggle
      value={mode}
      onChange={setMode}
      options={MODES.map(({ mode: value, label, help }) => ({
        value,
        label,
        help,
      }))}
    />
  );

  const title = `${formatClassName(cls)} · ${cls.subject}`;

  return (
    <SpeedDialLayout entries={planEntries} links={[overviewLink]}>
      {/* Equal outer columns keep the title centered */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="justify-self-start">
          <BackButton
            target="timetable"
            timetableUrl={`/timetable?date=${date}`}
          />
        </div>

        <div
          className="flex items-center gap-3"
          data-help="Klasse, Fach und Datum der Stunde. Die Pfeile springen zur vorherigen oder nächsten Stunde, auch anderer Klassen."
        >
          {
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
          }
          <div className="min-w-56 text-center portrait:min-w-44">
            <div className="flex items-center justify-center gap-2 text-xl font-bold tracking-tight">
              {accent && (
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: accent }}
                />
              )}
              {title}
              <LessonTypeBadge type={lessonType} />
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
          {
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
          }
        </div>

        {/* The right end stays free for the speed dial */}
        <div />
      </header>

      <ModeBar
        modes={modes}
        history={<HistoryButtons history={history} />}
        hint={
          mode == "grade" ? null : (
            <>
              {mode == "warn" && (
                <div className="flex items-center gap-2">
                  Antippen:
                  {WARNING_LEVELS.map((level, index) => (
                    <span
                      key={index}
                      className="rounded-full px-2.5 py-1 font-semibold"
                      style={{
                        background: level?.background ?? "var(--color-surface)",
                        color: level
                          ? "var(--color-ink)"
                          : "var(--color-muted)",
                      }}
                    >
                      {level?.label ?? "Normal"}
                    </span>
                  ))}
                </div>
              )}
              {mode == "comment" &&
                "Schüler antippen, um den Kommentar zu bearbeiten oder einen neuen zu schreiben"}
              {mode == "arrange" &&
                "Schüler zum Verschieben auf einen Platz ziehen"}
            </>
          )
        }
      >
        {mode == "grade" && (
          <GradeToolBar
            tool={activeTool}
            onChange={setTool}
            lessonType={lessonType}
            onLessonTypeChange={(type) => requestLessonType(date, type, grades)}
          />
        )}
      </ModeBar>

      <main
        className="card relative min-h-0 flex-1 bg-brand-400 p-2"
        data-help={`Sitzplan: ${currentMode.gridHelp}`}
      >
        {students.length == 0 && (
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
          showPhotos={showPhotos}
          grades={gradeMap}
          suggestions={suggestions}
          arranging={mode == "arrange"}
          showComments={mode == "comment"}
          zoomed={zoomed}
          onTap={handleTap}
          onMove={(student, x, y) =>
            history.moveSeat(
              student.id,
              x,
              y,
              roster.map(({ id, x, y }) => ({ studentId: id, x, y })),
              formatStudentName(student),
            )
          }
        />
        {hasTraits && showTraits && (
          <Button
            startIcon={<InfoIcon size={18} />}
            onClick={(event) => setTraitsAnchor(event.currentTarget)}
            className="absolute bottom-2 left-2 z-20 bg-brand-100 opacity-75 shadow-tile"
            data-help="Erklärt die Farben der Eigenschaften in dieser Klasse und zählt sie."
          >
            Legende
          </Button>
        )}
      </main>

      <TraitsLegend
        anchor={traitsAnchor}
        onClose={() => setTraitsAnchor(null)}
        traits={traits}
        students={students}
      />

      {confirmClear && (
        <ClearLessonDialog
          entries={grades}
          dateLabel={format(lessonDate, "EEEE, d. MMMM yyyy", { locale: de })}
          onClose={() => setConfirmClear(false)}
          onConfirm={async (parts) => {
            await clearLesson(cls.id, date, parts);
            history.reset();
            revalidate();
          }}
        />
      )}

      {lessonTypeDialog}

      {commenting && (
        <CommentDialog
          studentName={formatStudentName(commenting)}
          initial={gradeMap.get(commenting.id)?.comment ?? ""}
          onClose={() => setCommenting(null)}
          onSave={async (comment) => {
            setCommenting(null);
            await history.change(
              "Kommentar",
              commenting.id,
              date,
              gradeMap.get(commenting.id),
              { comment: comment.trim() || null },
              formatStudentName(commenting),
            );
          }}
        />
      )}
    </SpeedDialLayout>
  );
}
