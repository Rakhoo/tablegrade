import { format, parseISO } from "date-fns";
import { CheckIcon } from "../../components/icons";
import { LessonTypeBadge, Pill } from "../../components/LessonTypeBadge";
import { useLongPress } from "../../hooks/useLongPress";
import type { LessonType } from "../../lib/grades";
import { REPORT_LABELS, type ReportColumn } from "../../lib/reports";
import {
  getReportTint,
  HEADER_SLANT,
  HEADER_TINTS,
  REPORT_COLORS,
} from "./tableStyles";

type DateHeaderProps = {
  date: string;
  index: number;
  columns: number;
  isComplete: boolean;
  isCancelled: boolean;
  /** The current lesson (`?date=`), highlighted. */
  isCurrent: boolean;
  /** The type a mark column belongs to; oral columns have none. */
  lessonType: LessonType | null;
  /** Label of the type, e.g. the part of a project. */
  typeLabel: string;
  /** Tap on the date, to pick the lesson type. */
  onTap?: (element: HTMLElement) => void;
  onLongPress: () => void;
  /** Help text; the help shows it at the best visible date. */
  help?: string;
};

/** Column header with the tilted date; a long press toggles "Ausfall" for the lesson. */
export function DateHeader({
  date,
  index,
  columns,
  isComplete,
  isCancelled,
  isCurrent,
  lessonType,
  typeLabel,
  onTap,
  onLongPress,
  help,
}: DateHeaderProps) {
  const pressHandlers = useLongPress(onLongPress);
  return (
    <th
      className="sticky top-0 h-24 min-w-11 border-b border-line bg-surface"
      data-date={date}
      data-help={help}
      data-help-repeat
      // Framed in the help with the slant of the band
      data-help-skew={-30}
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
            ? "var(--color-line)"
            : isCurrent
              ? "var(--color-brand-500)"
              : HEADER_TINTS[index % 2],
        }}
      />
      {/* Rotates around its vertical center, placed on the band's center line, which keeps
          the date, with or without marker, at an equal distance from both band edges */}
      <span
        className={
          "absolute bottom-2.5 flex origin-left flex-col items-start gap-0.5 text-xs font-medium whitespace-nowrap " +
          (isCancelled
            ? "text-muted line-through"
            : isCurrent
              ? "font-bold text-white"
              : "")
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
        {lessonType && <LessonTypeBadge type={lessonType} label={typeLabel} />}
      </span>
    </th>
  );
}

type ReportHeaderProps = {
  column: ReportColumn;
  index: number;
  columns: number;
  onTap: (element: HTMLElement) => void;
};

/** Column header of a report: without date, its first column carries a pill across the report. */
export function ReportHeader({
  column,
  index,
  columns,
  onTap,
}: ReportHeaderProps) {
  return (
    <th
      className="sticky top-0 h-24 min-w-11 border-b border-line bg-surface"
      style={{ zIndex: 10 + columns - index }}
      onClick={(event) => onTap(event.currentTarget)}
    >
      <span
        className="absolute inset-0 origin-bottom -skew-x-30"
        style={{
          background: getReportTint(column.report, 22 + 8 * (index % 2)),
        }}
      />
      <span
        className="absolute bottom-2.5 flex origin-left text-xs font-medium whitespace-nowrap"
        style={{
          left: "calc(50% + 6px)",
          transform: "translateY(50%) rotate(-60deg)",
        }}
      >
        {column.label}
      </span>
      {column.groupSize > 0 && (
        <span
          className="absolute top-1 z-10 flex justify-center whitespace-nowrap"
          style={{
            left: HEADER_SLANT,
            minWidth: `${column.groupSize * 100}%`,
          }}
        >
          <Pill color={REPORT_COLORS[column.report]}>
            {REPORT_LABELS[column.report]}
          </Pill>
        </span>
      )}
    </th>
  );
}
