import { GradeIcon } from "../../components/GradeIcon";
import { CommentIcon } from "../../components/icons";
import { MarkBadge } from "../../components/MarkBadge";
import { useGradeColor } from "../../hooks/useGradeFormat";
import { SuggestedGradeIcon } from "../../components/SuggestedGradeIcon";
import type { GradeEntry, SeatedStudent, Trait } from "../../db";
import { getCommentPreview } from "../../lib/formatters";
import type { ReportColumn } from "../../lib/reports";
import {
  CELL_TINTS,
  getReportTint,
  LESSON_FRAME,
  OVERRIDE_COLOR,
} from "./tableStyles";

/**
 * Sizes come from CSS variables on the table (`--cell`, `--photo`), so the compact
 * table only changes them in one place.
 */
const CELL =
  "h-(--cell) min-w-(--cell) border-r border-b border-line p-0 text-center";
const CELL_BUTTON =
  "flex h-full min-h-(--cell) w-full items-center justify-center gap-0.5 px-0.5 active:bg-brand-100";

type NameCellProps = {
  student: SeatedStudent;
  rowIndex: number;
  name: string;
  /** Whether the names have a photo column; students without a photo keep its space. */
  photoColumn: boolean;
  /** Traits written out below the name. */
  traits: Trait[];
  /** Width of the widest name or traits line of the table in pixels, for all rows. */
  nameWidth: number;
  /** Whether only this student's entries are shown. */
  shown: boolean;
  /** Whether another student's entries are shown alone. */
  hidden: boolean;
  onTap: () => void;
};

/**
 * First cell of a row: number (1 to n from the top, matching the anonymous export), photo, name
 * and traits; a tap shows only this student's entries.
 */
export function NameCell({
  student,
  rowIndex,
  name,
  photoColumn,
  traits,
  nameWidth,
  shown,
  hidden,
  onTap,
}: NameCellProps) {
  return (
    <th
      className="sticky left-0 z-10 border-r border-b border-line p-0 text-left font-semibold whitespace-nowrap"
      style={{
        background: CELL_TINTS[rowIndex % 2][1],
        // Safari leaves the full width button out of the column width, so the cell itself
        // gets it: padding (2 × 0.75rem), number (1.5rem), gaps (0.5rem each), photo and name
        minWidth: `calc(${nameWidth}px + 3.5rem${photoColumn ? " + var(--photo) + 0.5rem" : ""})`,
      }}
    >
      <button
        type="button"
        aria-pressed={shown}
        data-help="Name antippen zeigt nur dessen Einträge, etwa für den Schüler selbst."
        data-help-repeat
        data-help-place="below"
        onClick={onTap}
        className={
          "flex min-h-(--cell) w-full items-center gap-2 px-3 py-0.5 text-left " +
          (hidden ? "opacity-40" : "")
        }
      >
        <span
          className="w-6 shrink-0 text-right text-xs font-medium text-muted tabular-nums"
          data-help="Laufende Nummer, wie „Schüler 1“, „Schüler 2“ … im anonymisierten Export."
          data-help-repeat
        >
          {rowIndex + 1}
        </span>
        {photoColumn &&
          (student.image ? (
            <img
              src={student.image}
              alt=""
              draggable={false}
              className="size-(--photo) shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="size-(--photo) shrink-0" />
          ))}
        {/* Never narrower than the longest name, so no name runs over the column; the parts
            are as wide as their text, which the overview measures */}
        <div className="shrink-0" style={{ minWidth: nameWidth }}>
          <span data-name-part className="block w-max">
            {name}
          </span>
          {traits.length > 0 && (
            <div
              data-name-part
              className="flex w-max gap-2 text-xs font-semibold"
            >
              {traits.map((trait) => (
                <span key={trait.id} style={{ color: trait.color }}>
                  {trait.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    </th>
  );
}

/** A cell of a student whose entries are covered, while another one's are shown alone. */
export const HiddenCell = () => <td className={`${CELL} bg-line`} />;

type ReportCellProps = {
  student: SeatedStudent;
  column: ReportColumn;
  rowIndex: number;
  columnIndex: number;
  label: string;
  grading: boolean;
  onTap: () => void;
};

/**
 * A report grade: calculated or set by hand, then with an arrow showing whether it is better
 * or worse than calculated, or "!" where too few assessments gave "n.b.".
 */
export function ReportCell({
  student,
  column,
  rowIndex,
  columnIndex,
  label,
  grading,
  onTap,
}: ReportCellProps) {
  const getGradeColor = useGradeColor();
  const value = column.values.get(student.id) ?? null;
  const suggestion = column.suggestions.get(student.id) ?? null;
  const changed = column.main && value != null;
  return (
    <td
      className={CELL}
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
        aria-label={label}
        className={`${CELL_BUTTON} ${column.main ? "" : "opacity-60"}`}
        onClick={onTap}
      >
        {value != null ? (
          <MarkBadge mark={value} />
        ) : (
          column.main && <span className="text-xs text-muted">n.b.</span>
        )}
        {changed && suggestion != null && value != suggestion && (
          <span
            className="font-bold"
            // Colored like the best and worst grade
            style={{ color: getGradeColor(value < suggestion ? 1 : 6) }}
          >
            {value < suggestion ? "↑" : "↓"}
          </span>
        )}
        {changed && suggestion == null && (
          <span
            className="font-bold"
            style={{ color: OVERRIDE_COLOR }}
            title="Statt „n.b.“ von Hand gesetzt"
          >
            !
          </span>
        )}
      </button>
    </td>
  );
}

type LessonCellProps = {
  kind: "oral" | "mark" | "projectMark";
  rowIndex: number;
  columnIndex: number;
  entry?: GradeEntry;
  /** The cell's own value: oral grade, exam or retake mark, or project mark. */
  value: number | null;
  /** The mark of another date of the exam or project, shown faintly in a closed cell. */
  chainMark: number | null;
  /** Whether the "absent" symbol belongs into this cell. */
  showAbsent: boolean;
  /** The suggested symbol while grading an empty oral cell. */
  suggestion?: number;
  /** How the comment shows: its first words, a small symbol or not at all. */
  comment: "preview" | "symbol" | null;
  /** Cancelled lesson or closed cell, both shown grayed out. */
  grayed: boolean;
  /** Closed: the mark lies on another date or the student writes a retake. */
  locked: boolean;
  /** The current lesson's column, framed. */
  current: boolean;
  /** Size of the grade symbols in pixels, smaller in the compact table. */
  iconSize: number;
  disabled: boolean;
  label: string;
  help: string;
  onTap: () => void;
};

/** A cell of a lesson column with its symbol or mark, a suggestion and the comment. */
export function LessonCell({
  kind,
  rowIndex,
  columnIndex,
  entry,
  value,
  chainMark,
  showAbsent,
  suggestion,
  comment,
  grayed,
  locked,
  current,
  iconSize,
  disabled,
  label,
  help,
  onTap,
}: LessonCellProps) {
  return (
    <td
      className={CELL}
      data-help={help}
      data-help-repeat
      style={{
        background: grayed
          ? "var(--color-line)"
          : CELL_TINTS[rowIndex % 2][columnIndex % 2],
        boxShadow: current ? LESSON_FRAME : undefined,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-disabled={locked || undefined}
        title={entry?.comment ?? undefined}
        className={`relative ${CELL_BUTTON} ${locked ? "opacity-60" : ""}`}
        onClick={onTap}
      >
        {value != null &&
          (kind == "oral" ? (
            <GradeIcon grade={value} size={iconSize} />
          ) : (
            <MarkBadge mark={value} />
          ))}
        {chainMark != null && <MarkBadge mark={chainMark} />}
        {showAbsent && <GradeIcon size={iconSize} />}
        {suggestion != null && (
          <SuggestedGradeIcon grade={suggestion} size={iconSize} />
        )}
        {entry?.comment && comment == "preview" && (
          <span className="relative ml-0.5 max-w-28 truncate rounded-lg bg-surface px-1.5 py-0.5 text-left text-[10px] leading-tight font-medium text-ink shadow-tile ring-1 ring-brand-200">
            {getCommentPreview(entry.comment, 3)}
          </span>
        )}
        {entry?.comment && comment == "symbol" && (
          <span className="absolute right-0 bottom-0 flex text-brand-600">
            <CommentIcon size={13} strokeWidth={2.5} />
          </span>
        )}
      </button>
    </td>
  );
}
