import { Button } from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { BackButton } from "../../components/BackButton";
import { EmptyState } from "../../components/EmptyState";
import { GradeToolBar } from "../../components/GradeToolBar";
import { HistoryButtons } from "../../components/HistoryButtons";
import { LessonTypeBadge } from "../../components/LessonTypeBadge";
import { ModeBar, ModeToggle } from "../../components/ModeBar";
import { PageHeader } from "../../components/PageHeader";
import {
  SpeedDialLayout,
  type SpeedDialEntry,
} from "../../components/SpeedDial";
import {
  classPageEntries,
  displaySwitch,
} from "../../components/speedDialEntries";
import {
  CheckIcon,
  ImageIcon,
  ImageOffIcon,
  InfoIcon,
  TableIcon,
  TagIcon,
  TagOffIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "../../components/icons";
import { clearLesson, type SeatedStudent } from "../../db";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { useEditHistory } from "../../hooks/useEditHistory";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import { useSettings } from "../../hooks/useSettings";
import { suggestGrade } from "../../lib/assessment";
import { formatClassName, formatStudentName } from "../../lib/formatters";
import {
  describeValues,
  getToolValues,
  type GradeTarget,
} from "../../lib/gradeTools";
import {
  DEFAULT_GRADE_TOOL,
  getValidGradeTool,
  isExamDay,
  MARK_KIND,
  type GradeTool,
} from "../../lib/grades";
import { createMarkRules } from "../../lib/lessonChains";
import { paths } from "../../lib/paths";
import { getZoomedArea } from "../../lib/seating";
import { getVisibleGrades, type ClassroomMode } from "../../lib/settings";
import { getClassColor } from "../../lib/subjectColors";
import { nextWarningLevel, WARNING_LEVELS } from "../../lib/warnings";
import type { ClassroomLoaderData } from "./classroomLoader";
import { ClearLessonDialog } from "./ClearLessonDialog";
import { CommentDialog } from "./CommentDialog";
import { EraseChoiceDialog } from "./EraseChoiceDialog";
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
  /** Hint below the mode choice; grading shows its tools and warning its levels instead. */
  hint?: string;
}[] = [
  {
    mode: "warn",
    label: "Ermahnen",
    help: "Modus Ermahnen: Antippen eines Schülers ermahnt ihn.",
    gridHelp:
      "Antippen ermahnt, ein zweites Mal verhängt eine Maßnahme, ein drittes nimmt beides zurück.",
  },
  {
    mode: "grade",
    label: "Bewerten",
    help: "Modus Bewerten: Symbole oder Noten für diese Stunde vergeben.",
    gridHelp:
      "Antippen vergibt das gewählte Werkzeug; gestrichelte Symbole sind Vorschläge.",
  },
  {
    mode: "comment",
    label: "Kommentieren",
    help: "Modus Kommentieren: Kommentare zu dieser Stunde lesen und schreiben.",
    gridHelp:
      "Antippen bearbeitet oder beginnt einen Kommentar; Sprechblasen zeigen seinen Anfang.",
    hint: "Schüler antippen, um den Kommentar zu bearbeiten oder einen neuen zu schreiben",
  },
  {
    mode: "arrange",
    label: "Anordnen",
    help: "Modus Anordnen: die Sitzordnung ändern.",
    gridHelp:
      "Schüler auf einen Platz ziehen; auf einem anderen Schüler tauschen beide.",
    hint: "Schüler zum Verschieben auf einen Platz ziehen",
  },
];

/** Hint of the warning mode: the levels a tap cycles through. */
function WarningLevels() {
  return (
    <div className="flex items-center gap-2">
      Antippen:
      {WARNING_LEVELS.map((level) => (
        <span
          key={level?.label ?? "none"}
          className="rounded-full px-2.5 py-1 font-semibold"
          style={{
            background: level?.background ?? "var(--color-surface)",
            color: level ? "var(--color-ink)" : "var(--color-muted)",
          }}
        >
          {level?.label ?? "Normal"}
        </span>
      ))}
    </div>
  );
}

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
    lessonTypes,
    classLessonTypes,
    previous,
    next,
  } = useLoaderData<ClassroomLoaderData>();
  const { revalidate } = useRevalidator();
  const settings = useSettings();
  const [mode, setMode] = useState<ClassroomMode>(settings.startMode);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [markTarget, setMarkTarget] = useState<"mark" | "projectMark">("mark");
  const [confirmClear, setConfirmClear] = useState(false);
  const traitsOption = useDisplayOption("traits");
  const photosOption = useDisplayOption("photos");
  const zoomOption = useDisplayOption("zoom");
  const [showTraits] = traitsOption;
  const [showPhotos] = photosOption;
  const [traitsAnchor, setTraitsAnchor] = useState<HTMLElement | null>(null);
  const [commenting, setCommenting] = useState<SeatedStudent | null>(null);
  /** A student with several grades in this lesson, asked which one to erase. */
  const [erasing, setErasing] = useState<{
    student: SeatedStudent;
    parts: GradeTarget[];
  } | null>(null);

  const gradeMap = new Map(grades.map((entry) => [entry.studentId, entry]));
  const lessonDate = parseISO(date);
  const dateLabel = format(lessonDate, "EEEE, d. MMMM yyyy", { locale: de });
  const history = useEditHistory(
    cls.id,
    {
      key: `classes/${cls.id}/${date}`,
      url: paths.seating(cls.id, date),
      label: `Sitzplan ${format(lessonDate, "dd.MM.")}`,
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

  const visibleGrades = getVisibleGrades(settings);
  const activeTool = getValidGradeTool(
    tool,
    lessonTypes,
    visibleGrades,
    settings.suggestions,
  );
  const examDay = isExamDay(lessonTypes);
  const hasRetake = lessonTypes.includes("retake");
  const hasProject = lessonTypes.some((type) => MARK_KIND[type] == "project");
  // The marks set by mark tools; with a retake and a project on one day the switch decides
  const markField: GradeTarget =
    hasRetake && hasProject ? markTarget : hasRetake ? "mark" : "projectMark";
  const rules = createMarkRules(
    Object.keys(classLessonTypes),
    (day) => classLessonTypes[day] ?? [],
    students.map((student) => student.id),
    classGrades,
  );
  const isRetaker = (studentId: number) => rules.isRetaker(studentId, date);

  /** The part of a student's entry a tool sets, `undefined` for erasing everything. */
  const targetOf = (
    studentId: number,
    option: GradeTool,
  ): GradeTarget | undefined => {
    if (option == "erase") return undefined;
    if (option.startsWith("mark:")) return markField;
    if (option == "absent" && isRetaker(studentId)) return "mark";
    return "oral";
  };
  /** Whether a tool cannot be used on a student: graded elsewhere, or a retaker's oral grade. */
  const isClosed = (studentId: number, option: GradeTool) => {
    const target = targetOf(studentId, option);
    return !!target && rules.isClosed(studentId, date, target);
  };
  const closedStudents = new Set(
    mode == "grade"
      ? students
          .filter((student) => isClosed(student.id, activeTool))
          .map((student) => student.id)
      : [],
  );

  // While grading, students without a symbol show what their previous ones suggest
  const suggestions = new Map(
    mode == "grade" && !examDay && settings.suggestions
      ? students
          .filter((student) => {
            const entry = gradeMap.get(student.id);
            return (
              entry?.grade == null && !entry?.absent && !isRetaker(student.id)
            );
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

  /** The parts of a student's entry holding a grade; none on exam days, which have only one. */
  const filledParts = (studentId: number): GradeTarget[] => {
    const entry = gradeMap.get(studentId);
    if (!entry || examDay) return [];
    const retaker = isRetaker(studentId);
    const parts: GradeTarget[] = [];
    if (entry.grade != null || (entry.absent && !retaker)) parts.push("oral");
    if (entry.projectMark != null) parts.push("projectMark");
    if (entry.mark != null || (entry.absent && retaker)) parts.push("mark");
    return parts;
  };

  /** Applies a grading tool to a student's entry, recorded in the undo history. */
  const applyTool = async (
    student: SeatedStudent,
    option: GradeTool,
    target: GradeTarget | undefined,
  ) => {
    const values = getToolValues(option, lessonTypes, target);
    if (!values) return;
    await history.change(
      "Bewertung",
      student.id,
      date,
      gradeMap.get(student.id),
      values,
      `${formatStudentName(student)}: ${describeValues(values)}`,
    );
  };

  /** Applies the current mode (and grading tool) to a tapped student. */
  const handleTap = async (student: SeatedStudent) => {
    if (mode == "warn") {
      const warnings = gradeMap.get(student.id)?.warnings ?? 0;
      const level = nextWarningLevel(warnings);
      await history.changeWarnings(
        student.id,
        date,
        warnings,
        level,
        `${formatStudentName(student)}: ${WARNING_LEVELS[level]?.label ?? "Normal"}`,
      );
    } else if (mode == "comment") {
      setCommenting(student);
    } else if (mode == "grade" && !isClosed(student.id, activeTool)) {
      const suggestion = suggestions.get(student.id);
      const option: GradeTool | null =
        activeTool != "suggestion"
          ? activeTool
          : suggestion == null
            ? null
            : `grade:${suggestion}`;
      if (!option) return;
      // With several grades, erasing asks which one goes
      const parts = option == "erase" ? filledParts(student.id) : [];
      if (parts.length > 1) setErasing({ student, parts });
      else await applyTool(student, option, targetOf(student.id, option));
    }
  };

  const currentMode = MODES.find((option) => option.mode == mode)!;
  const hasPhotos = students.some((student) => student.image);
  const hasTraits = students.some((student) => student.traitIds.length > 0);
  // Arranging needs the whole room, so it is never zoomed
  const canZoom =
    mode != "arrange" &&
    getZoomedArea(
      students.flatMap(({ x, y }) =>
        x != null && y != null ? [{ x, y }] : [],
      ),
    ) != null;

  const entries: SpeedDialEntry[] = [
    ...classPageEntries(cls.id, date, hasPhotos),
    {
      key: "clear",
      label: "Stunde zurücksetzen",
      icon: <TrashIcon />,
      danger: true,
      help: "Löscht ausgewählte Einträge dieser Stunde: Ermahnungen, Bewertungen oder Kommentare.",
      disabled: grades.length == 0,
      onClick: () => setConfirmClear(true),
    },
  ];
  if (canZoom) {
    entries.push(
      displaySwitch(
        {
          key: "zoom",
          label: "Zoom",
          icon: <ZoomInIcon />,
          offIcon: <ZoomOutIcon />,
          help: "Zeigt nur den Teil des Raums, in dem Schüler sitzen, so groß wie möglich.",
        },
        zoomOption,
      ),
    );
  }
  if (hasPhotos) {
    entries.push(
      displaySwitch(
        {
          key: "photos",
          label: "Bilder",
          icon: <ImageIcon />,
          offIcon: <ImageOffIcon />,
          help: "Zeigt die Fotos der Schüler im Sitzplan.",
        },
        photosOption,
      ),
    );
  }
  if (hasTraits) {
    entries.push(
      displaySwitch(
        {
          key: "traits",
          label: "Eigenschaften",
          icon: <TagIcon />,
          offIcon: <TagOffIcon />,
          help: "Zeigt die Eigenschaften als farbige Punkte um die Fotos.",
        },
        traitsOption,
      ),
    );
  }

  return (
    <SpeedDialLayout
      entries={entries}
      links={[
        {
          key: "overview",
          label: "Übersicht",
          icon: <TableIcon />,
          help: "Übersichtstabelle der Klasse mit allen Stunden und Noten.",
          to: paths.table(cls.id, date),
        },
      ]}
    >
      <PageHeader
        back={
          <BackButton target="timetable" timetableUrl={paths.timetable(date)} />
        }
        previous={previous && paths.seating(previous.id, previous.date)}
        next={next && paths.seating(next.id, next.date)}
        help="Klasse und Datum der Stunde; die Pfeile springen zur vorherigen oder nächsten Stunde."
        title={
          <>
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: getClassColor(cls, settings.levels).accent }}
            />
            {formatClassName(cls)} · {cls.subject}
            {lessonTypes.map((type) => (
              <LessonTypeBadge
                key={type}
                type={type}
                label={rules.typeLabel(date, type)}
              />
            ))}
            {rules.completion(date).lesson && (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background: "#15803d" }}
                aria-label="Vollständig bewertet"
              >
                <CheckIcon size={15} strokeWidth={3} />
              </span>
            )}
          </>
        }
        subtitle={dateLabel}
      />

      <ModeBar
        current={currentMode.label}
        modes={
          <ModeToggle
            value={mode}
            onChange={setMode}
            options={MODES.map(({ mode: value, label, help }) => ({
              value,
              label,
              help,
            }))}
          />
        }
        history={<HistoryButtons history={history} />}
        hint={mode == "warn" ? <WarningLevels /> : currentMode.hint}
      >
        {mode == "grade" && (
          <GradeToolBar
            tool={activeTool}
            onChange={setTool}
            lessonTypes={lessonTypes}
            availableTypes={rules.availableTypes(date)}
            onToggleType={(type) =>
              requestLessonType(date, lessonTypes, type, grades)
            }
            markTarget={markTarget}
            onMarkTargetChange={setMarkTarget}
          />
        )}
      </ModeBar>

      {/* With the legend shown, the plan ends above its button, zoomed or not */}
      <main
        className={
          "card relative min-h-0 flex-1 bg-brand-400 p-2 " +
          (hasTraits && showTraits ? "pb-13" : "")
        }
        data-help={`Sitzplan: ${currentMode.gridHelp}`}
      >
        {students.length == 0 && (
          <div className="absolute inset-0">
            <EmptyState title="Noch keine Schüler" tone="light">
              Über „Bearbeiten“ lässt sich die Schülerliste anlegen.
            </EmptyState>
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
          zoomed={zoomOption[0]}
          dimmed={closedStudents}
          onTap={handleTap}
          onMove={(student, x, y) =>
            history.moveSeat(
              student.id,
              x,
              y,
              roster.map((seated) => ({
                studentId: seated.id,
                x: seated.x,
                y: seated.y,
              })),
              formatStudentName(student),
            )
          }
        />
        {hasTraits && showTraits && (
          <Button
            startIcon={<InfoIcon size={18} />}
            onClick={(event) => setTraitsAnchor(event.currentTarget)}
            className="absolute bottom-2 left-2 z-20 bg-brand-100 opacity-75 shadow-tile"
            data-help="Farben der Eigenschaften mit ihrer Anzahl."
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
          dateLabel={dateLabel}
          onClose={() => setConfirmClear(false)}
          onConfirm={async (parts) => {
            await clearLesson(cls.id, date, parts);
            handleLessonChanged();
          }}
        />
      )}

      {lessonTypeDialog}

      {erasing && (
        <EraseChoiceDialog
          studentName={formatStudentName(erasing.student)}
          parts={erasing.parts}
          onChoose={(part) => applyTool(erasing.student, "erase", part)}
          onClose={() => setErasing(null)}
        />
      )}

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
