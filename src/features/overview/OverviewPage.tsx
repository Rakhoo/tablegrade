import { Button, Snackbar } from "@mui/material";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import {
  useLoaderData,
  useLocation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { BackButton } from "../../components/BackButton";
import { CancelDialog } from "../../components/CancelDialog";
import { EmptyState } from "../../components/EmptyState";
import { GradeToolBar } from "../../components/GradeToolBar";
import { HistoryButtons } from "../../components/HistoryButtons";
import { BottomBar, ModeBar, ModeToggle } from "../../components/ModeBar";
import { PageHeader } from "../../components/PageHeader";
import { GradeToolButton } from "../../components/GradePicker";
import {
  SpeedDialLayout,
  type SpeedDialLink,
} from "../../components/SpeedDial";
import { SeatsIcon } from "../../components/icons";
import type { GradeEntry, SeatedStudent } from "../../db";
import { useCompact } from "../../hooks/useCompact";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { useEditHistory } from "../../hooks/useEditHistory";
import { PointsContext } from "../../hooks/useGradeFormat";
import { useSettings } from "../../hooks/useSettings";
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
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { createMarkRules } from "../../lib/lessonChains";
import { lessonKey } from "../../lib/lessons";
import { getOverviewColumns, type LessonColumn } from "../../lib/overview";
import { paths } from "../../lib/paths";
import { getReportColumns } from "../../lib/reports";
import { SCHOOL_YEAR_PART_LABELS } from "../../lib/schoolYear";
import { getVisibleGrades, usesPoints } from "../../lib/settings";
import { CommentDialog } from "../classroom/CommentDialog";
import { ExportButton } from "./ExportButton";
import { overviewDialEntries } from "./overviewDialEntries";
import { MODES, type OverviewMode } from "./overviewModes";
import type { OverviewLoaderData } from "./overviewLoader";
import { OverviewTable } from "./OverviewTable";
import { StudentCard } from "./StudentCard";
import { describeCell, useCellGrading } from "./useCellGrading";
import { useDateMenu } from "./useDateMenu";

const entryKey = (studentId: string, date: string) => `${studentId}|${date}`;

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
  const points = usesPoints(settings, cls);
  const visibleGrades = getVisibleGrades(settings);
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<OverviewMode>("view");
  const grading = mode == "grade";
  /** Student whose entries alone stay visible, e.g. to show them to the student. */
  const [shownStudent, setShownStudent] = useState<string | null>(null);
  /** Whether the shown student's entries are listed on a card above the table. */
  const [cardOpen, setCardOpen] = useState(false);
  const [cardFirstSetting] = useDisplayOption("studentCard");
  /**
   * Whether a tap on a name opens the card or only covers the others: as set in the settings
   * for a freshly opened table, then as chosen last in it.
   */
  const [cardFirst, setCardFirst] = useState(cardFirstSetting);
  // The arrows switch the class without leaving the page, the student may not be in the new one
  const [shownClass, setShownClass] = useState(cls.id);
  if (shownClass != cls.id) {
    setShownClass(cls.id);
    setShownStudent(null);
    setCardOpen(false);
    setCardFirst(cardFirstSetting);
  }
  // Looked up instead of trusted, as the render that resets it still sees the old id
  const shown = students.find((student) => student.id == shownStudent);
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const nicknamesOption = useDisplayOption("nicknames");
  const photosOption = useDisplayOption("photos");
  const traitsOption = useDisplayOption("traits");
  const lastNameSortOption = useDisplayOption("lastNameSort");
  const compact = useCompact();
  const [gradeButton] = useDisplayOption("gradeButton");
  // Small screens show the narrowest table: nicknames, no photos, no traits
  const useNicknames = nicknamesOption[0] || compact;
  const [sortByLastName] = lastNameSortOption;
  const showPhotos = photosOption[0] && !compact;
  const showTraits = traitsOption[0] && !compact;
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
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

  const entryMap = new Map<string, GradeEntry>(
    entries.map((entry) => [entryKey(entry.studentId, entry.date), entry]),
  );
  const entryOf = (studentId: string, date: string) =>
    entryMap.get(entryKey(studentId, date));
  // The lesson the seating plan was left from, otherwise today's or the next one
  const lessonDate = searchParams.get("date") ?? seatingDate;
  const typesOf = (date: string): LessonType[] =>
    lessonTypes[lessonKey(cls.id, date)] ?? [];
  const isLessonCancelled = (date: string) =>
    lessons.includes(lessonKey(cls.id, date));
  const isCancelled = (date: string) =>
    days.includes(date) || isLessonCancelled(date);
  const studentIds = students.map((student) => student.id);
  const rules = createMarkRules(dates, typesOf, studentIds, entries);
  const { openMenu, menu } = useDateMenu({
    classId: cls.id,
    entries,
    reports,
    reportGrades,
    typesOf,
    isCancelled,
    rules,
    onChanged: handleLessonChanged,
    onMessage: setMessage,
  });

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

  const nameOf = useNicknames ? getStudentLabel : formatStudentName;
  // By last name the shown name only decides between equal last names
  const rows = [...students].sort(
    (a, b) =>
      (sortByLastName ? a.lastName.localeCompare(b.lastName, "de") : 0) ||
      nameOf(a).localeCompare(nameOf(b), "de"),
  );
  const hasPhotos = students.some((student) => student.image);
  const hasTraits = students.some((student) => student.traitIds.length > 0);
  /** Traits come sorted by name, so this is alphabetical as well */
  const traitsOf = (student: SeatedStudent) =>
    traits.filter((trait) => student.traitIds.includes(trait.id));
  const suggestionFor = (student: SeatedStudent, date: string) =>
    suggestGrade(
      entries.filter((entry) => entry.studentId == student.id),
      date,
      visibleGrades,
    );
  const { gradeCell, gradeReport } = useCellGrading({
    tool: activeTool,
    rules,
    isCancelled,
    entryOf,
    typesOf,
    suggestionFor,
    reportGrades,
    history,
    points,
    onMessage: setMessage,
  });
  const handleTap = (student: SeatedStudent, column: LessonColumn) =>
    mode == "comment"
      ? setCommenting({ student, date: column.date })
      : gradeCell(student, column);

  /** The table as shown, for the export. */
  const exportData = () => ({
    schoolClass: cls,
    title: `${formatClassName(cls)} ${cls.subject}, ${formatSchoolYear(cls.year)}, ${SCHOOL_YEAR_PART_LABELS[cls.part]}`,
    students: rows.map((student) => ({
      id: student.id,
      name: nameOf(student),
      nameParts: [student.firstName, student.lastName, student.nickname ?? ""],
      image: showPhotos ? student.image : null,
      traits: showTraits ? traitsOf(student) : [],
    })),
    columns,
    entryOf,
    typesOf,
    settings,
  });

  const dialEntries = overviewDialEntries({
    classId: cls.id,
    lessonDate,
    hasPhotos,
    hasTraits,
    compact,
    options: {
      photos: photosOption,
      traits: traitsOption,
      nicknames: nicknamesOption,
      lastNameSort: lastNameSortOption,
    },
  });

  const currentMode = MODES.find((option) => option.value == mode);

  const seatingLink: SpeedDialLink = {
    key: "seating",
    label: "Sitzplan",
    icon: <SeatsIcon />,
    help: "Sitzplan der Klasse: in der Stunde, aus der diese Übersicht geöffnet wurde, sonst in der heutigen oder nächsten.",
    to: paths.seating(cls.id, lessonDate),
  };
  const modes = (layout: "row" | "full") => (
    <ModeToggle
      layout={layout}
      value={mode}
      onChange={setMode}
      options={MODES.map((option) => ({
        ...option,
        label: compact && option.value == "comment" ? "Komm." : option.label,
        disabled: option.value != "view" && dates.length == 0,
      }))}
    />
  );
  const toolButton = (
    <GradeToolButton
      tool={activeTool}
      onChange={setTool}
      hideMarks={!hasMarkColumns}
      className="h-12 w-full max-w-80"
    />
  );
  const hint =
    mode == "comment"
      ? "Zelle antippen, um den Kommentar zu bearbeiten oder einen neuen zu schreiben"
      : shown
        ? "Ein Tipp auf einen anderen Namen zeigt dessen Einträge"
        : "Ein Tipp auf einen Namen zeigt nur die Einträge des Schülers";
  /**
   * A tap on a name shows only that student's entries, with the card on top if it was used last;
   * while one student is shown, another name switches to them and the shown name opens the card.
   */
  const showStudent = (studentId: string) => {
    if (shown ? studentId == shown.id : cardFirst) openCard();
    setShownStudent(studentId);
  };
  const openCard = () => {
    setCardOpen(true);
    setCardFirst(true);
  };
  /** Closes the card but keeps the others covered, which the next name tap does again. */
  const closeCard = () => {
    setCardOpen(false);
    setCardFirst(false);
  };
  const showAll = () => {
    setShownStudent(null);
    setCardOpen(false);
  };
  /** Who alone is shown, with the way to the card and back to all; slim on small screens. */
  const shownNotice = shown && (
    <>
      <span className="min-w-0 truncate">
        {compact ? "Nur " : "Nur die Einträge von "}
        <span className="font-semibold text-ink">{nameOf(shown)}</span>
        {compact ? "" : " sind sichtbar."}
      </span>
      <Button size="small" onClick={openCard}>
        Karte
      </Button>
      <Button size="small" onClick={showAll}>
        Alle zeigen
      </Button>
    </>
  );

  return (
    <PointsContext value={points}>
      <SpeedDialLayout entries={dialEntries} links={[seatingLink]}>
        <PageHeader
          back={<BackButton timetableUrl={paths.timetable(lessonDate)} />}
          previous={previous && paths.table(previous.id, previous.date)}
          next={next && paths.table(next.id, next.date)}
          help="Klasse und Halbjahr; die Pfeile wechseln zur Klasse davor oder danach im Stundenplan."
          title={`${formatClassName(cls)} · ${cls.subject}`}
          subtitle={[
            formatSchoolYear(cls.year),
            SCHOOL_YEAR_PART_LABELS[cls.part],
            lessonDate && format(parseISO(lessonDate), "dd.MM."),
          ]
            .filter(Boolean)
            .join(" · ")}
        />

        {!compact && (
          <ModeBar
            current={currentMode?.label ?? ""}
            modes={modes("row")}
            history={<HistoryButtons history={history} />}
            footer={shownNotice}
            hint={grading ? null : hint}
          >
            {grading &&
              (gradeButton ? (
                <div className="flex justify-center">{toolButton}</div>
              ) : (
                <GradeToolBar
                  tool={activeTool}
                  onChange={setTool}
                  hideMarks={!hasMarkColumns}
                />
              ))}
          </ModeBar>
        )}

        {compact && shown && (
          <div className="card flex shrink-0 items-center gap-1 py-0.5 pr-1 pl-3 text-sm text-muted">
            {shownNotice}
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <OverviewTable
            classId={cls.id}
            columns={columns}
            rows={rows}
            empty={
              students.length == 0 ? (
                <EmptyState title="Noch keine Schüler" tone="muted">
                  Über „Bearbeiten“ lässt sich die Schülerliste anlegen.
                </EmptyState>
              ) : dates.length == 0 ? (
                <EmptyState title="Noch kein Unterricht" tone="muted">
                  In diesem Halbjahr gab es noch keine Stunde dieser Klasse.
                </EmptyState>
              ) : null
            }
            corner={
              <ExportButton
                getData={exportData}
                order={
                  sortByLastName
                    ? "alphabetisch nach Nachname"
                    : useNicknames
                      ? "alphabetisch nach Spitzname, sonst Vorname"
                      : "alphabetisch nach Vorname, dann Nachname"
                }
                onMessage={setMessage}
              />
            }
            lessonDate={lessonDate}
            // Opening a table shows the lesson's column, or the last one before it, in the middle
            scrollTarget={
              lessonDate
                ? dates.filter((date) => date <= lessonDate).at(-1)
                : dates.at(-1)
            }
            days={days}
            mode={mode}
            nameOf={nameOf}
            traitsOf={traitsOf}
            showPhotos={showPhotos && hasPhotos}
            showTraits={showTraits}
            shown={shown}
            onShow={showStudent}
            entryOf={entryOf}
            typesOf={typesOf}
            isCancelled={isCancelled}
            rules={rules}
            suggestionFor={suggestionFor}
            onTap={handleTap}
            onReportTap={gradeReport}
            onMenu={openMenu}
            onCancel={setCancelTarget}
          />
        </div>

        {compact && (
          <BottomBar
            current={currentMode?.label ?? ""}
            modes={modes("full")}
            history={<HistoryButtons history={history} round />}
          >
            {grading ? toolButton : hint}
          </BottomBar>
        )}

        {shown && cardOpen && (
          <StudentCard
            student={shown}
            name={nameOf(shown)}
            // The setting itself: small screens leave photos out of the table only for room
            showPhoto={photosOption[0]}
            traits={traitsOf(shown)}
            columns={columns}
            entryOf={entryOf}
            typesOf={typesOf}
            isCancelled={isCancelled}
            rules={rules}
            onCover={closeCard}
            onClose={showAll}
          />
        )}

        {menu}

        {cancelTarget && (
          <CancelDialog
            date={parseISO(cancelTarget)}
            schoolClass={cls}
            isCancelled={isLessonCancelled(cancelTarget)}
            onClose={() => setCancelTarget(null)}
            onChanged={handleLessonChanged}
          />
        )}

        {commenting && (
          <CommentDialog
            studentName={formatStudentName(commenting.student)}
            initial={
              entryOf(commenting.student.id, commenting.date)?.comment ?? ""
            }
            onClose={() => setCommenting(null)}
            onSave={async (comment) => {
              setCommenting(null);
              await history.change(
                "Kommentar",
                commenting.student.id,
                commenting.date,
                entryOf(commenting.student.id, commenting.date),
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
    </PointsContext>
  );
}
