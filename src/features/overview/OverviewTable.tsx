import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { GradeEntry, SeatedStudent, Trait } from "../../db";
import { useSettings } from "../../hooks/useSettings";
import { formatStudentName } from "../../lib/formatters";
import { isExamDay, MARK_FIELD, MARK_KIND } from "../../lib/grades";
import type { MarkRules, TypesOf } from "../../lib/lessonChains";
import {
  getColumnKey,
  type LessonColumn,
  type OverviewColumn,
} from "../../lib/overview";
import type { ReportColumn } from "../../lib/reports";
import { CELL_HELP, type OverviewMode } from "./overviewModes";
import { HiddenCell, LessonCell, NameCell, ReportCell } from "./TableCells";
import { DateHeader, ReportHeader } from "./TableHeaders";

/** Sizes of the table's cells, photos and symbols (see `TableCells`), as CSS variables. */
const COMFORTABLE_SIZES = {
  "--cell": "2.75rem",
  "--photo": "2rem",
} as CSSProperties;
/** The compact table: lower rows, narrower columns, smaller photos. */
const COMPACT_SIZES = {
  "--cell": "2rem",
  "--photo": "1.5rem",
} as CSSProperties;

type OverviewTableProps = {
  classId: number;
  columns: OverviewColumn[];
  /** Students in display order. */
  rows: SeatedStudent[];
  /** Shown instead of the table, e.g. while there are no students or lessons. */
  empty: ReactNode;
  /** Content of the top left corner cell (the export button). */
  corner: ReactNode;
  /** The lesson the page was opened for; its column is highlighted. */
  lessonDate: string | null | undefined;
  /** Date of the column centered when the table or lesson is opened. */
  scrollTarget: string | undefined;
  /** Dates cancelled as whole days, managed in the timetable. */
  days: string[];
  mode: OverviewMode;
  nameOf: (student: SeatedStudent) => string;
  traitsOf: (student: SeatedStudent) => Trait[];
  showPhotos: boolean;
  showTraits: boolean;
  /** Student whose entries alone stay visible. */
  shown: SeatedStudent | undefined;
  onShow: (studentId: number | null) => void;
  entryOf: (studentId: number, date: string) => GradeEntry | undefined;
  typesOf: TypesOf;
  isCancelled: (date: string) => boolean;
  rules: MarkRules;
  suggestionFor: (student: SeatedStudent, date: string) => number | undefined;
  onTap: (student: SeatedStudent, column: LessonColumn) => void;
  onReportTap: (student: SeatedStudent, column: ReportColumn) => void;
  /** Opens the menu of a date's types and reports. */
  onMenu: (date: string, anchor: HTMLElement) => void;
  /** Opens the cancellation dialog of a lesson. */
  onCancel: (date: string) => void;
};

/** The scrollable overview table: names in rows, lesson and report columns, a header per date. */
export function OverviewTable({
  classId,
  columns,
  rows,
  empty,
  corner,
  lessonDate,
  scrollTarget,
  days,
  mode,
  nameOf,
  traitsOf,
  showPhotos,
  showTraits,
  shown,
  onShow,
  entryOf,
  typesOf,
  isCancelled,
  rules,
  suggestionFor,
  onTap,
  onReportTap,
  onMenu,
  onCancel,
}: OverviewTableProps) {
  const settings = useSettings();
  /** Size of the grade symbols in the cells; marks match it (see `TableCells`). */
  const iconSize = settings.compactTable ? 20 : 26;
  const grading = mode == "grade";
  const tableArea = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const area = tableArea.current;
    const header = area?.querySelector<HTMLElement>(
      `th[data-date="${scrollTarget}"]`,
    );
    if (!area || !header) return;
    area.scrollLeft =
      header.offsetLeft - area.clientWidth / 2 + header.offsetWidth / 2;
    // Only when a table or lesson is opened, not on every change of its data
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, lessonDate]);

  // The name column is as wide as the widest rendered name or traits line, measured in the
  // table, as only the real fonts give the true width (canvas fonts differ on iPads)
  const [nameWidth, setNameWidth] = useState(0);
  const nameColumnKey = rows
    .map(
      (student) =>
        `${nameOf(student)}|${showTraits ? traitsOf(student).map(({ name }) => name) : ""}`,
    )
    .join(";");
  useLayoutEffect(() => {
    const parts =
      tableArea.current?.querySelectorAll<HTMLElement>("[data-name-part]") ??
      [];
    setNameWidth(
      Math.ceil(
        Math.max(
          0,
          ...[...parts].map((part) => part.getBoundingClientRect().width),
        ),
      ),
    );
  }, [nameColumnKey, shown?.id]);

  /** Whether a column is complete: oral grades, an exam's or retake's marks, project marks. */
  const isComplete = ({ date, kind }: LessonColumn) => {
    const completion = rules.completion(date);
    if (kind == "projectMark") return completion.project;
    if (kind == "mark" && !isExamDay(typesOf(date))) return completion.retake;
    return completion.lesson;
  };

  /** The header of a lesson column; a mark column carries the type it belongs to. */
  const renderDateHeader = (column: LessonColumn, index: number) => {
    const { date, kind } = column;
    const columnType =
      kind == "oral"
        ? null
        : (typesOf(date).find(
            (type) =>
              MARK_KIND[type] == (kind == "projectMark" ? "project" : "exam"),
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
        typeLabel={columnType ? rules.typeLabel(date, columnType) : ""}
        onTap={isCancelled(date) ? undefined : (anchor) => onMenu(date, anchor)}
        // Whole cancelled days are managed in the timetable
        onLongPress={() => !days.includes(date) && onCancel(date)}
        help="Datum antippen: Typ der Stunde wählen oder eine Teil- oder Halbjahresnote anfügen; lange drücken: Ausfall."
      />
    );
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
        iconSize={iconSize}
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
        onTap={() => onTap(student, column)}
      />
    );
  };

  return (
    <main
      ref={tableArea}
      className="card h-full overflow-auto"
      data-help-group
      data-help="Tabelle mit allen Stunden und Noten der Klasse."
    >
      {empty ?? (
        <table
          className="border-separate border-spacing-0"
          style={settings.compactTable ? COMPACT_SIZES : COMFORTABLE_SIZES}
        >
          <thead>
            <tr>
              {/* Above all date headers, whose layers grow with the columns */}
              <th
                className="sticky top-0 left-0 bg-surface p-2 text-left align-top"
                style={{ zIndex: 20 + columns.length }}
              >
                {corner}
              </th>
              {columns.map((column, index) =>
                column.kind == "report" ? (
                  <ReportHeader
                    key={getColumnKey(column)}
                    column={column}
                    index={index}
                    columns={columns.length}
                    onTap={(anchor) => onMenu(column.date, anchor)}
                  />
                ) : (
                  renderDateHeader(column, index)
                ),
              )}
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
                    photoColumn={showPhotos}
                    // Nor does the student shown their own entries see them
                    traits={showTraits && !shown ? traitsOf(student) : []}
                    nameWidth={nameWidth}
                    shown={shown?.id == student.id}
                    hidden={hidden}
                    onTap={() =>
                      onShow(shown?.id == student.id ? null : student.id)
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
                        iconSize={iconSize}
                        onTap={() => onReportTap(student, column)}
                      />
                    ) : (
                      renderLessonCell(student, column, rowIndex, columnIndex)
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
  );
}
