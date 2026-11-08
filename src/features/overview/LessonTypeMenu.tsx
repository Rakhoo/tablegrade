import { Button, Divider, Popover } from "@mui/material";
import type { LessonType } from "../../lib/grades";
import { LESSON_TYPE_LABELS } from "../../lib/lessons";
import { REPORT_LABELS, type ReportKind } from "../../lib/reports";

type LessonTypeMenuProps = {
  anchor: HTMLElement | null;
  /** The types the lesson can get; none for a cancelled lesson. */
  available: LessonType[];
  /** The lesson's types, highlighted; a second tap removes one. */
  types: LessonType[];
  /** Whether the date has a report of a kind. */
  hasReport: (kind: ReportKind) => boolean;
  onType: (type: LessonType) => void;
  onReport: (kind: ReportKind) => void;
  onClose: () => void;
};

/** Menu of a date in the overview: the lesson types and the reports following the lesson. */
export function LessonTypeMenu({
  anchor,
  available,
  types,
  hasReport,
  onType,
  onReport,
  onClose,
}: LessonTypeMenuProps) {
  return (
    <Popover
      open={!!anchor}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <div className="flex flex-col gap-1 p-2">
        {available.map((type) => (
          <Button
            key={type}
            variant={types.includes(type) ? "contained" : "text"}
            onClick={() => onType(type)}
          >
            {LESSON_TYPE_LABELS[type]}
          </Button>
        ))}
        {available.length > 0 && <Divider />}
        {(Object.keys(REPORT_LABELS) as ReportKind[]).map((kind) => (
          <Button
            key={kind}
            variant={hasReport(kind) ? "contained" : "text"}
            onClick={() => onReport(kind)}
          >
            {REPORT_LABELS[kind]}
          </Button>
        ))}
      </div>
    </Popover>
  );
}
