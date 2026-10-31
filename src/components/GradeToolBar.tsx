import { IconButton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import {
  getGradeDefinition,
  getGradeTools,
  type GradeKey,
  type GradeTool,
  type LessonType,
} from "../lib/grades";
import { LESSON_TYPE_LABELS } from "../lib/lessons";
import { GradeIcon } from "./GradeIcon";
import { CloseIcon, CommentIcon, TrashIcon } from "./icons";
import { MarkBadge } from "./MarkBadge";

const TOOL_EXTRAS: { tool: "erase" | "comment"; label: string }[] = [
  { tool: "erase", label: "Löschen" },
  { tool: "comment", label: "Kommentar" },
];

const toolLabel = (tool: GradeKey | "erase" | "comment") =>
  getGradeDefinition(tool)?.label ??
  TOOL_EXTRAS.find((extra) => extra.tool == tool)!.label;

/** Round icon of a tool, matching the size of the grade badges. */
function ToolIcon({
  tool,
  size,
}: {
  tool: GradeKey | "erase" | "comment";
  size: number;
}) {
  if (tool != "erase" && tool != "comment") {
    return <GradeIcon grade={tool} size={size} />;
  }
  return (
    <span
      className={
        "flex items-center justify-center rounded-full " +
        (tool == "erase"
          ? "bg-red-50 text-red-500"
          : "bg-brand-100 text-brand-600")
      }
      style={{ width: size, height: size }}
    >
      {tool == "erase" ? (
        <TrashIcon size={size * 0.5} />
      ) : (
        <CommentIcon size={size * 0.5} />
      )}
    </span>
  );
}

type GradeToolBarProps = {
  tool: GradeTool;
  onChange: (tool: GradeTool) => void;
  /** Leaves the grading mode. */
  onExit: () => void;
  /** Type of the graded lesson; without one all tools are offered (overview table). */
  lessonType?: LessonType;
  /** Changes the type of the graded lesson. */
  onLessonTypeChange?: (type: LessonType) => void;
  /** Hides the marks when no lesson can take them (overview without special lessons). */
  hideMarks?: boolean;
};

/**
 * Toolbar of the grading mode: all tools stay open, so switching takes a single tap.
 * Classic marks get their own row, shown for exams and projects.
 */
export function GradeToolBar({
  tool,
  onChange,
  onExit,
  lessonType,
  onLessonTypeChange,
  hideMarks = false,
}: GradeToolBarProps) {
  const { symbols, marks } = getGradeTools(lessonType);
  const options = [...symbols, ...TOOL_EXTRAS.map((extra) => extra.tool)];

  return (
    <div className="card flex flex-col gap-1 px-2 py-1">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {lessonType && onLessonTypeChange && (
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={lessonType}
            onChange={(_, value: LessonType | null) =>
              value && onLessonTypeChange(value)
            }
            className="mr-2 rounded-full bg-brand-50 p-0.5"
          >
            {(Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map((type) => (
              <ToggleButton key={type} value={type} className="toggle-pill">
                {LESSON_TYPE_LABELS[type]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            aria-pressed={option == tool}
            className={
              "flex w-16 flex-col items-center gap-0.5 rounded-2xl py-0.5 text-[10px] leading-tight font-medium whitespace-nowrap transition-transform active:scale-95 " +
              // Visual gap between the grade symbols and the extra tools
              (index == symbols.length ? "ml-2 " : "") +
              (option == tool
                ? "bg-brand-100 text-ink ring-2 ring-brand-300"
                : "text-muted")
            }
            onClick={() => onChange(option)}
          >
            <ToolIcon tool={option} size={32} />
            {toolLabel(option)}
          </button>
        ))}
        <IconButton
          aria-label="Bewertung verlassen"
          onClick={onExit}
          className="ml-2 bg-brand-600 text-white"
        >
          <CloseIcon />
        </IconButton>
      </div>
      {marks.length > 0 && !hideMarks && (
        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-line pt-1">
          {marks.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option == tool}
              className={
                "flex h-8 w-9 items-center justify-center rounded-xl transition-transform active:scale-95 " +
                (option == tool ? "bg-brand-100 ring-2 ring-brand-300" : "")
              }
              onClick={() => onChange(option)}
            >
              {option == "eraseMark" ? (
                <span className="text-red-500">
                  <TrashIcon size={16} />
                </span>
              ) : (
                <MarkBadge mark={option.slice("mark:".length)} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
