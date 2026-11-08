import { GradeIcon } from "../../components/GradeIcon";
import { CommentIcon } from "../../components/icons";
import { MarkBadge } from "../../components/MarkBadge";
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

const CELL = "h-11 min-w-11 border-r border-b border-line p-0 text-center";
const CELL_BUTTON =
  "flex h-full min-h-11 w-full items-center justify-center gap-0.5 px-0.5 active:bg-brand-100";

type NameCellProps = {
  student: SeatedStudent;
  rowIndex: number;
  name: string;
  /** Whether the names have a photo column; students without a photo keep its space. */
  photoColumn: boolean;
  /** Traits written out below the name. */
  traits: Trait[];
  /** Whether only this student's entries are shown. */
  shown: boolean;
  /** Whether another student's entries are shown alone. */
  hidden: boolean;
  onTap: () => void;
};

/** First cell of a row: photo, name and traits; a tap shows only this student's entries. */
export function NameCell({
  student,
  rowIndex,
  name,
  photoColumn,
  traits,
  shown,
  hidden,
  onTap,
}: NameCellProps) {
  return (
    <th
      className="sticky left-0 z-10 border-r border-b border-line p-0 text-left font-semibold whitespace-nowrap"
      style={{ background: CELL_TINTS[rowIndex % 2][1] }}
    >
      <button
        type="button"
        aria-pressed={shown}
        data-help="Name antippen zeigt nur dessen Einträge, etwa für den Schüler selbst."
        data-help-repeat
        data-help-place="below"
        onClick={onTap}
        className={
          "flex w-full items-center gap-2 px-3 py-1 text-left " +
          (hidden ? "opacity-40" : "")
        }
      >
        {photoColumn &&
          (student.image ? (
            <img
              src={student.image}
              alt=""
              draggable={false}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="h-8 w-8 shrink-0" />
          ))}
        <div>
          {name}
          {traits.length > 0 && (
            <div className="flex gap-2 text-xs font-semibold">
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
            style={{ color: value < suggestion ? "#15803d" : "#dc2626" }}
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
            <GradeIcon grade={value} size={26} />
          ) : (
            <MarkBadge mark={value} />
          ))}
        {chainMark != null && <MarkBadge mark={chainMark} />}
        {showAbsent && <GradeIcon size={26} />}
        {suggestion != null && (
          <SuggestedGradeIcon grade={suggestion} size={26} />
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
