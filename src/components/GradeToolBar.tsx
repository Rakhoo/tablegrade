import { IconButton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import {
  formatMark,
  getGradeTools,
  getToolValue,
  type GradeTool,
  type LessonType,
} from "../lib/grades";
import { useSettings } from "../hooks/useSettings";
import { LESSON_TYPE_LABELS } from "../lib/lessons";
import { getVisibleGrades } from "../lib/settings";
import { GradeIcon } from "./GradeIcon";
import type { useGradingHistory } from "../hooks/useGradingHistory";
import {
  CloseIcon,
  CommentIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  WandIcon,
} from "./icons";
import { MarkBadge } from "./MarkBadge";

type ExtraTool = "suggestion" | "erase" | "comment";

const EXTRA_LABELS: Record<ExtraTool, string> = {
  suggestion: "Vorschlag",
  erase: "Löschen",
  comment: "Kommentar",
};

/** Round icon of a tool that is no grade. */
function ExtraToolIcon({ tool, size }: { tool: ExtraTool; size: number }) {
  if (tool == "suggestion") {
    return (
      <span
        className="flex items-center justify-center rounded-full border-2 border-dashed border-brand-500 bg-brand-50 text-brand-600"
        style={{ width: size, height: size }}
      >
        <WandIcon size={size * 0.6} />
      </span>
    );
  }
  return (
    <span
      className={
        "flex items-center justify-center rounded-full " +
        (tool == "erase" ? "text-red-500" : "bg-brand-100 text-brand-600")
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
  /** Undo and redo of the current grading session. */
  history: Pick<
    ReturnType<typeof useGradingHistory>,
    "undo" | "redo" | "canUndo" | "canRedo"
  >;
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
  history,
}: GradeToolBarProps) {
  const settings = useSettings();
  const { grades, marks } = getGradeTools(
    getVisibleGrades(settings),
    lessonType,
  );

  const buttonClass = (option: GradeTool) =>
    "flex flex-col items-center gap-0.5 rounded-2xl p-1 text-[10px] leading-tight font-medium whitespace-nowrap transition-transform active:scale-95 " +
    (option == tool
      ? "bg-brand-100 text-ink ring-2 ring-brand-300"
      : "text-muted");

  const renderExtra = (option: ExtraTool) => (
    <button
      key={option}
      type="button"
      aria-label={EXTRA_LABELS[option]}
      aria-pressed={option == tool}
      className={`w-16 ${buttonClass(option)}`}
      onClick={() => onChange(option)}
    >
      <ExtraToolIcon tool={option} size={32} />
      {EXTRA_LABELS[option]}
    </button>
  );

  const renderSymbol = (option: GradeTool) => (
    <button
      key={option}
      type="button"
      aria-label={
        option == "absent" ? "entschuldigt" : formatMark(getToolValue(option))
      }
      aria-pressed={option == tool}
      className={buttonClass(option)}
      onClick={() => onChange(option)}
    >
      <GradeIcon
        grade={option == "absent" ? undefined : getToolValue(option)}
        size={symbolSize}
      />
    </button>
  );

  const symbols: GradeTool[] = [...grades, "absent"];
  // With all grades enabled the symbols form two rows
  const symbolSize = symbols.length > 9 ? 32 : 40;

  const typeToggle = lessonType && onLessonTypeChange && (
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      value={lessonType}
      onChange={(_, value: LessonType | null) =>
        value && onLessonTypeChange(value)
      }
      className="rounded-full bg-brand-50 p-0.5"
    >
      {(Object.keys(LESSON_TYPE_LABELS) as LessonType[]).map((type) => (
        <ToggleButton key={type} value={type} className="toggle-pill">
          {LESSON_TYPE_LABELS[type]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  return (
    <div className="card flex flex-col gap-1 px-2 py-1">
      {/* Equal outer columns keep the symbols in the center of the screen */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex items-center gap-1">
          {/* Exams have no symbols, so there is nothing to suggest */}
          {lessonType != "exam" &&
            settings.suggestions &&
            renderExtra("suggestion")}
          {renderExtra("comment")}
          {/* Only wide screens have room for the lesson type next to the tools */}
          <div className="ml-2 max-[1169px]:hidden">{typeToggle}</div>
        </div>
        <div
          className={
            symbols.length > 9
              ? "grid grid-cols-9 justify-items-center gap-0.5"
              : "flex items-center gap-1"
          }
        >
          {symbols.map(renderSymbol)}
        </div>
        <div className="flex items-center justify-end gap-1">
          <IconButton
            aria-label="Rückgängig"
            disabled={!history.canUndo}
            onClick={history.undo}
          >
            <UndoIcon />
          </IconButton>
          <IconButton
            aria-label="Wiederherstellen"
            disabled={!history.canRedo}
            onClick={history.redo}
          >
            <RedoIcon />
          </IconButton>
          {renderExtra("erase")}
          <IconButton
            aria-label="Bewertung verlassen"
            onClick={onExit}
            className="bg-brand-600 text-white"
          >
            <CloseIcon />
          </IconButton>
        </div>
      </div>
      {typeToggle && (
        <div className="flex justify-center min-[1170px]:hidden">
          {typeToggle}
        </div>
      )}
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
                <MarkBadge mark={getToolValue(option)} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
