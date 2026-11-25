import { Button } from "@mui/material";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { BackButton } from "../../components/BackButton";
import { EmptyState } from "../../components/EmptyState";
import { HistoryButtons } from "../../components/HistoryButtons";
import { LessonTypeBadge } from "../../components/LessonTypeBadge";
import { BottomBar, ModeBar, ModeToggle } from "../../components/ModeBar";
import { PageHeader } from "../../components/PageHeader";
import { OptionPicker, type PickRequest } from "../../components/OptionPicker";
import {
  SpeedDialLayout,
  type SpeedDialLink,
} from "../../components/SpeedDial";
import { InfoIcon, TableIcon } from "../../components/icons";
import { clearLesson, type SeatedStudent } from "../../db";
import { useCompact, useLandscape, useShort } from "../../hooks/useCompact";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { useGradePickSections } from "../../hooks/useGradePickSections";
import { PointsContext } from "../../hooks/useGradeFormat";
import { useEditHistory } from "../../hooks/useEditHistory";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import { useSettings } from "../../hooks/useSettings";
import { formatStudentName } from "../../lib/formatters";
import { fromPickKey, type GradeTarget } from "../../lib/gradeTools";
import {
  DEFAULT_GRADE_TOOL,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { paths } from "../../lib/paths";
import { getZoomedArea } from "../../lib/seating";
import { usesPoints, type ClassroomMode } from "../../lib/settings";
import { getClassColor } from "../../lib/subjectColors";
import { nextWarningLevel } from "../../lib/warnings";
import { classroomDialEntries } from "./classroomDialEntries";
import { MODES } from "./classroomModes";
import { LessonTitle, ModeTools } from "./ModeTools";
import { WARNING_SECTION } from "./warningSection";
import { useLessonGrading } from "./useLessonGrading";
import type { ClassroomLoaderData } from "./classroomLoader";
import { ClassroomRail } from "./ClassroomRail";
import { ClearLessonDialog } from "./ClearLessonDialog";
import { CommentDialog } from "./CommentDialog";
import { EraseChoiceDialog } from "./EraseChoiceDialog";
import { SeatGrid } from "./SeatGrid";
import { SeatLegend } from "./SeatLegend";
import "./ClassroomPage.css";

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
    duties,
    lessonTypes,
    classLessonTypes,
    previous,
    next,
  } = useLoaderData<ClassroomLoaderData>();
  const { revalidate } = useRevalidator();
  const settings = useSettings();
  const points = usesPoints(settings, cls);
  const [mode, setMode] = useState<ClassroomMode>(settings.startMode);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const [markTarget, setMarkTarget] = useState<GradeTarget>("mark");
  const [confirmClear, setConfirmClear] = useState(false);
  const traitsOption = useDisplayOption("traits");
  const photosOption = useDisplayOption("photos");
  const zoomOption = useDisplayOption("zoom");
  const dutiesOption = useDisplayOption("duties");
  const [showTraits] = traitsOption;
  const [showDuties] = dutiesOption;
  const [showPhotos] = photosOption;
  const [gradeButton] = useDisplayOption("gradeButton");
  const compact = useCompact();
  const short = useShort();
  // The side bar needs a landscape screen of some width: large ones or phones in landscape;
  // narrow windows get the phone's portrait layout
  const rail = useLandscape() && (!compact || short);
  // Small screens always grade with the tool button, others if chosen in the settings
  const oneButton = compact || gradeButton;
  const [picking, setPicking] = useState<PickRequest | null>(null);
  const [legendAnchor, setLegendAnchor] = useState<HTMLElement | null>(null);
  const [commenting, setCommenting] = useState<SeatedStudent | null>(null);
  /** A student with several grades in this lesson, asked which one to erase. */
  const [erasing, setErasing] = useState<{
    student: SeatedStudent;
    parts: GradeTarget[];
  } | null>(null);

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

  const {
    gradeMap,
    activeTool,
    markField,
    rules,
    closedStudents,
    suggestions,
    applyTool,
    gradeStudent,
    setWarnings,
  } = useLessonGrading({
    students,
    grades,
    classGrades,
    date,
    lessonTypes,
    classLessonTypes,
    grading: mode == "grade",
    tool,
    markTarget,
    history,
    points,
    onEraseChoice: setErasing,
  });

  /** Applies the current mode (and grading tool) to a tapped student. */
  const handleTap = async (student: SeatedStudent) => {
    if (mode == "warn") {
      const warnings = gradeMap.get(student.id)?.warnings ?? 0;
      await setWarnings(student, nextWarningLevel(warnings));
    } else if (mode == "comment") {
      setCommenting(student);
    } else if (mode == "grade") {
      await gradeStudent(student, activeTool);
    }
  };

  const gradeSections = useGradePickSections(lessonTypes);
  /** Opens the choices for one student only: grades while grading, levels while warning. */
  const handleHold = (student: SeatedStudent, anchor: DOMRect) => {
    const title = formatStudentName(student);
    if (mode == "grade") {
      setPicking({
        anchor,
        title,
        sections: gradeSections,
        held: true,
        onPick: (key) => {
          const { tool: picked, target } = fromPickKey(key);
          void gradeStudent(student, picked, target);
        },
      });
    } else if (mode == "warn") {
      setPicking({
        anchor,
        title,
        selected: String(gradeMap.get(student.id)?.warnings ?? 0),
        held: true,
        sections: [WARNING_SECTION],
        onPick: (key) => void setWarnings(student, Number(key)),
      });
    }
  };

  const currentMode = MODES.find((option) => option.mode == mode)!;
  const hasPhotos = students.some((student) => student.image);
  const hasTraits = students.some((student) => student.traitIds.length > 0);
  const hasDuties = students.some((student) =>
    duties.some((duty) => duty.id == student.dutyId),
  );
  // The legend explains what is shown: traits and duties, each only if switched on
  const hasLegend = (hasTraits && showTraits) || (hasDuties && showDuties);
  // Arranging needs the whole room, so it is never zoomed
  const canZoom =
    mode != "arrange" &&
    getZoomedArea(
      students.flatMap(({ x, y }) =>
        x != null && y != null ? [{ x, y }] : [],
      ),
    ) != null;

  const dialEntries = classroomDialEntries({
    classId: cls.id,
    date,
    hasPhotos,
    hasDuties,
    hasTraits,
    canZoom,
    canClear: grades.length > 0,
    onClear: () => setConfirmClear(true),
    options: {
      zoom: zoomOption,
      photos: photosOption,
      duties: dutiesOption,
      traits: traitsOption,
    },
  });
  const overviewLink: SpeedDialLink = {
    key: "overview",
    label: "Übersicht",
    icon: <TableIcon />,
    help: "Übersichtstabelle der Klasse mit allen Stunden und Noten.",
    to: paths.table(cls.id, date),
  };
  const back = <BackButton timetableUrl={paths.timetable(date)} />;
  const previousUrl = previous && paths.seating(previous.id, previous.date);
  const nextUrl = next && paths.seating(next.id, next.date);
  const title = (
    <LessonTitle
      schoolClass={cls}
      accent={getClassColor(cls, settings.levels).accent}
      badges={lessonTypes.map((type) => (
        <LessonTypeBadge
          key={type}
          type={type}
          label={rules.typeLabel(date, type)}
        />
      ))}
      complete={rules.completion(date).lesson}
    />
  );
  const modes = (layout: "row" | "full" | "grid") => (
    <ModeToggle
      layout={layout}
      value={mode}
      onChange={setMode}
      options={MODES.map(({ mode: value, label, help }) => ({
        value,
        label: compact && value == "comment" ? "Komm." : label,
        help,
      }))}
    />
  );
  const toggleType = (type: LessonType) =>
    requestLessonType(date, lessonTypes, type, grades);
  const selectTool = (chosen: GradeTool, target?: GradeTarget) => {
    setTool(chosen);
    if (target) setMarkTarget(target);
  };
  /** What the current mode shows next to the plan: tools while grading, else a hint. */
  const modeContent = (layout: "bar" | "rail") => (
    <ModeTools
      mode={mode}
      layout={layout}
      oneButton={oneButton}
      tool={activeTool}
      markTarget={markField}
      onToolChange={selectTool}
      lessonTypes={lessonTypes}
      availableTypes={rules.availableTypes(date)}
      onToggleType={toggleType}
      hint={currentMode.hint}
    />
  );

  return (
    <PointsContext value={points}>
      <SpeedDialLayout
        entries={dialEntries}
        links={[overviewLink]}
        className={rail ? "flex-row gap-3" : undefined}
      >
        {rail ? (
          <ClassroomRail
            back={<BackButton timetableUrl={paths.timetable(date)} iconOnly />}
            title={title}
            subtitle={format(lessonDate, "EEE, d. MMM yyyy", { locale: de })}
            previous={previousUrl}
            next={nextUrl}
            history={
              <HistoryButtons
                history={history}
                round={compact}
                stacked={!compact}
              />
            }
            modes={modes("grid")}
          >
            {modeContent("rail")}
          </ClassroomRail>
        ) : (
          <PageHeader
            back={back}
            previous={previousUrl}
            next={nextUrl}
            help="Klasse und Datum der Stunde; die Pfeile springen zur vorherigen oder nächsten Stunde."
            title={title}
            subtitle={
              compact
                ? format(lessonDate, "EEE, dd.MM.yy", { locale: de })
                : dateLabel
            }
          />
        )}

        {!rail && !compact && (
          <ModeBar
            current={currentMode.label}
            modes={modes("row")}
            history={<HistoryButtons history={history} />}
            hint={mode != "grade" && modeContent("bar")}
          >
            {mode == "grade" && modeContent("bar")}
          </ModeBar>
        )}

        {/* With the legend shown, the plan ends above its button, zoomed or not */}
        <main
          className={
            "card relative min-h-0 min-w-0 flex-1 bg-brand-400 p-2 " +
            (hasLegend ? "pb-13 " : "") +
            (rail ? "-order-1" : "")
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
            duties={showDuties ? duties : []}
            showPhotos={showPhotos}
            grades={gradeMap}
            suggestions={suggestions}
            arranging={mode == "arrange"}
            showComments={mode == "comment"}
            zoomed={zoomOption[0]}
            dimmed={closedStudents}
            onTap={handleTap}
            onHold={handleHold}
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
          {hasLegend && (
            <Button
              startIcon={<InfoIcon size={18} />}
              onClick={(event) => setLegendAnchor(event.currentTarget)}
              className="absolute bottom-2 left-2 z-20 bg-brand-100 opacity-75 shadow-tile"
              data-help="Symbole der Dienste und Farben der Eigenschaften mit ihrer Anzahl."
            >
              Legende
            </Button>
          )}
        </main>

        {compact && !rail && (
          <BottomBar
            current={currentMode.label}
            modes={modes("full")}
            history={<HistoryButtons history={history} round />}
          >
            {modeContent("bar")}
          </BottomBar>
        )}

        {picking && (
          <OptionPicker request={picking} onClose={() => setPicking(null)} />
        )}

        <SeatLegend
          anchor={legendAnchor}
          onClose={() => setLegendAnchor(null)}
          traits={showTraits ? traits : []}
          duties={showDuties ? duties : []}
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
    </PointsContext>
  );
}
