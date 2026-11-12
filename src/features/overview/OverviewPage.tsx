import { Button, Menu, MenuItem, Snackbar } from "@mui/material";
import { format, parseISO } from "date-fns";
import { useLayoutEffect, useRef, useState } from "react";
import {
  useLoaderData,
  useLocation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { BackButton } from "../../components/BackButton";
import { EmptyState } from "../../components/EmptyState";
import { CancelDialog } from "../../components/CancelDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GradeToolBar } from "../../components/GradeToolBar";
import { HistoryButtons } from "../../components/HistoryButtons";
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
  BadgeIcon,
  DownloadIcon,
  ImageIcon,
  ImageOffIcon,
  SeatsIcon,
  SmileIcon,
  TagIcon,
  TagOffIcon,
} from "../../components/icons";
import {
  addReport,
  removeReport,
  type GradeEntry,
  type SeatedStudent,
} from "../../db";
import { useDisplayOption } from "../../hooks/useDisplayOption";
import { useEditHistory } from "../../hooks/useEditHistory";
import { useLessonTypeChange } from "../../hooks/useLessonTypeChange";
import { useSettings } from "../../hooks/useSettings";
import { suggestGrade } from "../../lib/assessment";
import {
  formatClassName,
  formatSchoolYear,
  formatStudentName,
  getStudentLabel,
} from "../../lib/formatters";
import { describeValues, FAIL_TOOL, getToolValues } from "../../lib/gradeTools";
import {
  DEFAULT_GRADE_TOOL,
  formatMark,
  getToolValue,
  getValidGradeTool,
  isExamDay,
  MARK_FIELD,
  MARK_KIND,
  type GradeTool,
  type LessonType,
} from "../../lib/grades";
import { createMarkRules } from "../../lib/lessonChains";
import { lessonKey } from "../../lib/lessons";
import {
  getColumnKey,
  getOverviewColumns,
  type LessonColumn,
} from "../../lib/overview";
import { paths } from "../../lib/paths";
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
import { CommentDialog } from "../classroom/CommentDialog";
import { LessonTypeMenu } from "./LessonTypeMenu";
import { LetExportDialog } from "./LetExportDialog";
import type { OverviewLoaderData } from "./overviewLoader";
import { HiddenCell, LessonCell, NameCell, ReportCell } from "./TableCells";
import { DateHeader, ReportHeader } from "./TableHeaders";

/** What a tap on a cell does: nothing (viewing), apply the grading tool or edit the comment. */
type OverviewMode = "view" | "grade" | "comment";

/** The modes with their names and explanations. */
const MODES: { value: OverviewMode; label: string; help: string }[] = [
  {
    value: "view",
    label: "Betrachten",
    help: "Modus Betrachten: die Tabelle nur ansehen, ein Tipp in eine Zelle ändert nichts.",
  },
  {
    value: "grade",
    label: "Bewerten",
    help: "Modus Bewerten: Werkzeug wählen und Zellen antippen.",
  },
  {
    value: "comment",
    label: "Kommentieren",
    help: "Modus Kommentieren: Kommentare der Stunden lesen und schreiben.",
  },
];

/** What a tap on a cell does per mode, explained by the help at the best visible cell. */
const CELL_HELP: Record<OverviewMode, string> = {
  view: "Zum Ändern oben „Bewerten“ oder „Kommentieren“ wählen.",
  grade:
    "Antippen wendet das gewählte Werkzeug an; Teil- und Halbjahresnoten lassen sich mit Noten korrigieren.",
  comment:
    "Antippen bearbeitet oder beginnt einen Kommentar; Sprechblasen zeigen seinen Anfang.",
};

const entryKey = (studentId: number, date: string) => `${studentId}|${date}`;

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
    sameHalfClasses,
  } = useLoaderData<OverviewLoaderData>();
  const location = useLocation();
  const settings = useSettings();
  const visibleGrades = getVisibleGrades(settings);
  const { revalidate } = useRevalidator();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<OverviewMode>("view");
  const grading = mode == "grade";
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
  const [tool, setTool] = useState<GradeTool>(DEFAULT_GRADE_TOOL);
  const nicknamesOption = useDisplayOption("nicknames");
  const photosOption = useDisplayOption("photos");
  const traitsOption = useDisplayOption("traits");
  const [useNicknames] = nicknamesOption;
  const [showPhotos] = photosOption;
  const [showTraits] = traitsOption;
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);
  const [letExport, setLetExport] = useState(false);
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
  const entryOf = (studentId: number, date: string) =>
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

  /** Whether a column is complete: oral grades, an exam's or retake's marks, project marks. */
  const isComplete = ({ date, kind }: LessonColumn) => {
    const completion = rules.completion(date);
    if (kind == "projectMark") return completion.project;
    if (kind == "mark" && !isExamDay(typesOf(date))) return completion.retake;
    return completion.lesson;
  };

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
  /** Name and date of a cell, for the undo history. */
  const describeCell = (student: SeatedStudent, date: string) =>
    `${formatStudentName(student)}, ${format(parseISO(date), "dd.MM.")}`;

  /** Why the current tool cannot be used on a cell, `null` if it can. */
  const toolError = (student: SeatedStudent, { date, kind }: LessonColumn) => {
    if (activeTool != "erase" && rules.isClosed(student.id, date, kind)) {
      if (kind == "oral")
        return "Wer nachschreibt, bekommt in dieser Stunde keine mündliche Note.";
      if (kind == "projectMark" && rules.isRetaker(student.id, date))
        return "Wer nachschreibt, wird in dieser Stunde nicht für das Projekt bewertet.";
      return "Dieser Schüler hat seine Note für diese Klausur bzw. dieses Projekt an einem anderen Termin.";
    }
    if (isCancelled(date))
      return activeTool == FAIL_TOOL || activeTool == "erase"
        ? null
        : "Bei Ausfall kann nur die 6 vergeben oder gelöscht werden.";
    const fits =
      activeTool == "erase" ||
      (activeTool == "absent"
        ? kind != "projectMark"
        : activeTool.startsWith("mark:")
          ? kind != "oral"
          : kind == "oral");
    return fits ? null : "Dieses Werkzeug passt nicht zu dieser Spalte.";
  };

  const handleTap = async (student: SeatedStudent, column: LessonColumn) => {
    const { date, kind } = column;
    if (mode == "comment") return setCommenting({ student, date });
    const error = toolError(student, column);
    if (error) return setMessage(error);
    const entry = entryOf(student.id, date);
    if (activeTool == "suggestion" && (entry?.grade != null || entry?.absent))
      return;
    const values = getToolValues(
      activeTool == "suggestion"
        ? `grade:${suggestionFor(student, date)}`
        : activeTool,
      typesOf(date),
      kind,
    );
    if (!values)
      return setMessage("Dieses Werkzeug passt nicht zu dieser Stunde.");
    await history.change(
      "Bewertung",
      student.id,
      date,
      entry,
      values,
      `${describeCell(student, date)}: ${describeValues(values)}`,
    );
  };

  /** Tap on a report's grade: marks replace the calculated grade, erasing brings it back. */
  const handleReportTap = async (
    student: SeatedStudent,
    { date, report: kind }: ReportColumn,
  ) => {
    if (!activeTool.startsWith("mark:") && activeTool != "erase")
      return setMessage("Hier können nur Noten gesetzt oder gelöscht werden.");
    const before =
      reportGrades.find(
        (grade) =>
          grade.date == date &&
          grade.kind == kind &&
          grade.studentId == student.id,
      )?.grade ?? null;
    const after = activeTool == "erase" ? null : getToolValue(activeTool);
    await history.changeReport(
      { date, kind },
      student.id,
      before,
      after,
      `${formatStudentName(student)}, ${REPORT_LABELS[kind]}: ${
        after == null ? "Vorschlag" : formatMark(after)
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

  const runExport = async (fileType: "csv" | "pdf") => {
    setExportMenu(null);
    const data = {
      schoolClass: cls,
      title: `${formatClassName(cls)} ${cls.subject}, ${formatSchoolYear(cls.year)}, ${SCHOOL_YEAR_PART_LABELS[cls.part]}`,
      students: rows.map((student) => ({
        id: student.id,
        name: nameOf(student),
        image: showPhotos ? student.image : null,
        traits: showTraits ? traitsOf(student) : [],
      })),
      columns,
      entryOf,
      typesOf,
      settings,
    };
    try {
      const { exportCsv, exportPdf } =
        await import("../../services/overviewExport");
      await (fileType == "csv" ? exportCsv(data) : exportPdf(data));
      setMessage("Der Export wurde heruntergeladen.");
    } catch (error) {
      console.error(error);
      const { name, message: reason } = error as Error;
      setMessage(`Der Export ist fehlgeschlagen (${name}: ${reason}).`);
    }
  };

  /** Renders a lesson cell of a student with what belongs into it. */
  const renderLessonCell = (
    student: SeatedStudent,
    column: LessonColumn,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const { date, kind } = column;
    const entry = entryOf(student.id, date);
    const cancelled = isCancelled(date);
    const isExam = isExamDay(typesOf(date));
    const retaker = rules.isRetaker(student.id, date);
    // Graded on another date of the exam or project, shown faintly
    const locked = rules.isClosed(student.id, date, kind);
    const markKind = kind == "projectMark" ? "project" : "exam";
    const value = kind == "oral" ? entry?.grade : entry?.[MARK_FIELD[markKind]];
    const suggests =
      kind == "oral" &&
      value == null &&
      !entry?.absent &&
      grading &&
      settings.suggestions &&
      !cancelled &&
      !locked;
    return (
      <LessonCell
        key={getColumnKey(column)}
        kind={kind}
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        entry={entry}
        value={value ?? null}
        chainMark={
          locked && kind != "oral"
            ? rules.chainMark(markKind, student.id, date)
            : null
        }
        // "Absent" belongs to the exam or retake for those writing it
        showAbsent={
          !!entry?.absent &&
          (kind == "mark" ? isExam || retaker : kind == "oral" && !retaker)
        }
        suggestion={suggests ? suggestionFor(student, date) : undefined}
        comment={
          kind == "oral" || (isExam && kind == "mark")
            ? mode == "comment"
              ? "preview"
              : "symbol"
            : null
        }
        grayed={cancelled || locked}
        locked={locked}
        current={date == lessonDate}
        disabled={mode == "view"}
        label={`${formatStudentName(student)}, ${date}`}
        help={CELL_HELP[mode]}
        onTap={() => handleTap(student, column)}
      />
    );
  };

  const dialEntries: SpeedDialEntry[] = classPageEntries(
    cls.id,
    lessonDate,
    hasPhotos,
  );
  if (hasPhotos) {
    dialEntries.push(
      displaySwitch(
        {
          key: "photos",
          label: "Bilder",
          icon: <ImageIcon />,
          offIcon: <ImageOffIcon />,
          help: "Zeigt die Fotos vor den Namen.",
        },
        photosOption,
      ),
    );
  }
  dialEntries.push(
    displaySwitch(
      {
        key: "nicknames",
        label: "Spitznamen",
        icon: <SmileIcon />,
        offIcon: <BadgeIcon />,
        help: "Zeigt Spitznamen statt der vollen Namen; die Reihenfolge folgt den Namen.",
      },
      nicknamesOption,
    ),
  );
  if (hasTraits) {
    dialEntries.push(
      displaySwitch(
        {
          key: "traits",
          label: "Eigenschaften",
          icon: <TagIcon />,
          offIcon: <TagOffIcon />,
          help: "Zeigt die Eigenschaften ausgeschrieben unter den Namen.",
        },
        traitsOption,
      ),
    );
  }

  const currentMode = MODES.find((option) => option.value == mode)!;
  const menuDate = typeMenu?.date;

  return (
    <SpeedDialLayout
      entries={dialEntries}
      links={[
        {
          key: "seating",
          label: "Sitzplan",
          icon: <SeatsIcon />,
          help: "Sitzplan der Klasse: in der Stunde, aus der diese Übersicht geöffnet wurde, sonst in der heutigen oder nächsten.",
          to: paths.seating(cls.id, lessonDate),
        },
      ]}
    >
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

      <ModeBar
        current={currentMode.label}
        modes={
          <ModeToggle
            value={mode}
            onChange={setMode}
            options={MODES.map((option) => ({
              ...option,
              disabled: option.value != "view" && dates.length == 0,
            }))}
          />
        }
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
          data-help-group
          data-help="Tabelle mit allen Stunden und Noten der Klasse."
        >
          {students.length == 0 ? (
            <EmptyState title="Noch keine Schüler" tone="muted">
              Über „Bearbeiten“ lässt sich die Schülerliste anlegen.
            </EmptyState>
          ) : dates.length == 0 ? (
            <EmptyState title="Noch kein Unterricht" tone="muted">
              In diesem Halbjahr gab es noch keine Stunde dieser Klasse.
            </EmptyState>
          ) : (
            <table className="border-separate border-spacing-0">
              <thead>
                <tr>
                  {/* Above all date headers, whose layers grow with the columns */}
                  <th
                    className="sticky top-0 left-0 bg-surface p-2 text-left align-top"
                    style={{ zIndex: 20 + columns.length }}
                  >
                    <Button
                      size="small"
                      data-help={`Exportiert die Tabelle als PDF oder CSV${settings.letHelper ? " oder für den LET-Helfer" : ""}.`}
                      data-help-place="above"
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
                    // A mark column carries the type it belongs to, the oral one none
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
                        lessonType={columnType}
                        typeLabel={
                          columnType ? rules.typeLabel(date, columnType) : ""
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
                        help="Datum antippen: Typ der Stunde wählen oder eine Teil- oder Halbjahresnote anfügen; lange drücken: Ausfall."
                      />
                    );
                  })}
                  {/* Room for the tilted date of the last column */}
                  <th className="sticky top-0 min-w-16 border-b border-line bg-surface" />
                </tr>
              </thead>
              <tbody>
                {rows.map((student, rowIndex) => {
                  const hidden = !!shown && student.id != shown.id;
                  return (
                    <tr key={student.id}>
                      <NameCell
                        student={student}
                        rowIndex={rowIndex}
                        name={nameOf(student)}
                        photoColumn={showPhotos && hasPhotos}
                        // Nor does the student shown their own entries see them
                        traits={showTraits && !shown ? traitsOf(student) : []}
                        shown={shownStudent == student.id}
                        hidden={hidden}
                        onTap={() =>
                          setShownStudent(
                            shownStudent == student.id ? null : student.id,
                          )
                        }
                      />
                      {columns.map((column, columnIndex) =>
                        hidden ? (
                          <HiddenCell key={getColumnKey(column)} />
                        ) : column.kind == "report" ? (
                          <ReportCell
                            key={getColumnKey(column)}
                            student={student}
                            column={column}
                            rowIndex={rowIndex}
                            columnIndex={columnIndex}
                            label={`${formatStudentName(student)}, ${column.label}`}
                            grading={grading}
                            onTap={() => handleReportTap(student, column)}
                          />
                        ) : (
                          renderLessonCell(
                            student,
                            column,
                            rowIndex,
                            columnIndex,
                          )
                        ),
                      )}
                      <td />
                    </tr>
                  );
                })}
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
        {settings.letHelper && (
          <MenuItem
            onClick={() => {
              setExportMenu(null);
              setLetExport(true);
            }}
          >
            LET-Helfer
          </MenuItem>
        )}
      </Menu>

      {letExport && (
        <LetExportDialog
          course={{ cls, students, entries, reports, dates, typesOf }}
          otherClasses={sameHalfClasses}
          onClose={() => setLetExport(false)}
          onDone={setMessage}
        />
      )}

      <LessonTypeMenu
        anchor={typeMenu?.anchor ?? null}
        available={
          menuDate && !isCancelled(menuDate)
            ? rules.availableTypes(menuDate)
            : []
        }
        types={menuDate ? typesOf(menuDate) : []}
        hasReport={(kind) => !!menuDate && hasReport(menuDate, kind)}
        onType={(type) => {
          setTypeMenu(null);
          requestLessonType(
            menuDate!,
            typesOf(menuDate!),
            type,
            entries.filter((entry) => entry.date == menuDate),
          );
        }}
        onReport={(kind) => toggleReport(menuDate!, kind)}
        onClose={() => setTypeMenu(null)}
      />

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
  );
}
