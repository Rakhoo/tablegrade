import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import {
  formatMark,
  getGradeTools,
  isExamDay,
  MARK_KIND,
  getToolValue,
  type GradeTool,
  type LessonType,
} from "../lib/grades";
import { useSettings } from "../hooks/useSettings";
import { LESSON_TYPE_LABELS, LESSON_TYPE_ORDER } from "../lib/lessons";
import { getVisibleGrades } from "../lib/settings";
import { GradeIcon } from "./GradeIcon";
import { TrashIcon, WandIcon } from "./icons";
import { MarkBadge } from "./MarkBadge";

type ExtraTool = "suggestion" | "erase";

const EXTRA_LABELS: Record<ExtraTool, string> = {
  suggestion: "Vorschlag",
  erase: "Löschen",
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
      className="flex items-center justify-center rounded-full text-red-500"
      style={{ width: size, height: size }}
    >
      <TrashIcon size={size * 0.5} />
    </span>
  );
}

type GradeToolBarProps = {
  tool: GradeTool;
  onChange: (tool: GradeTool) => void;
  /** Types of the graded lesson; without them all tools are offered (overview table). */
  lessonTypes?: LessonType[];
  /** The types the lesson can get now, follow-ups only after an incomplete exam or project. */
  availableTypes?: LessonType[];
  /** Adds or removes a type of the graded lesson. */
  onToggleType?: (type: LessonType) => void;
  /** Which mark the marks set, when the lesson has a retake and a project. */
  markTarget?: "mark" | "projectMark";
  onMarkTargetChange?: (target: "mark" | "projectMark") => void;
  /** Hides the marks when no lesson can take them (overview without special lessons). */
  hideMarks?: boolean;
};

/**
 * Tools of the grading mode: all stay open, so switching takes a single tap. Classic marks
 * get their own row, shown for exams, retakes and projects.
 */
export function GradeToolBar({
  tool,
  onChange,
  lessonTypes,
  availableTypes,
  onToggleType,
  markTarget,
  onMarkTargetChange,
  hideMarks = false,
}: GradeToolBarProps) {
  const settings = useSettings();
  const { grades, marks } = getGradeTools(
    getVisibleGrades(settings),
    lessonTypes,
  );
  const hasBothMarks =
    !!lessonTypes?.includes("retake") &&
    lessonTypes.some((type) => MARK_KIND[type] == "project");

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
        option == "suggestion"
          ? EXTRA_LABELS.suggestion
          : formatMark(getToolValue(option))
      }
      aria-pressed={option == tool}
      className={buttonClass(option)}
      onClick={() => onChange(option)}
    >
      {option == "suggestion" ? (
        <ExtraToolIcon tool="suggestion" size={symbolSize} />
      ) : (
        <GradeIcon grade={getToolValue(option)} size={symbolSize} />
      )}
    </button>
  );

  // The suggestion ends the symbols; exams have none, so there is nothing to suggest
  const offersSuggestion =
    (!lessonTypes || !isExamDay(lessonTypes)) && settings.suggestions;
  const symbols: GradeTool[] = [
    ...grades,
    ...(offersSuggestion ? (["suggestion"] as const) : []),
  ];
  // With all grades enabled the symbols form two rows
  const symbolSize = symbols.length > 9 ? 32 : 40;

  // Not exclusive: a lesson can be a retake and a project; a second tap removes a type
  const typeToggle = lessonTypes && onToggleType && (
    <ToggleButtonGroup
      size="small"
      color="primary"
      value={lessonTypes}
      className="rounded-full bg-brand-50 p-0.5"
    >
      {LESSON_TYPE_ORDER.filter(
        (type) =>
          lessonTypes.includes(type) || (availableTypes ?? []).includes(type),
      ).map((type) => (
        <ToggleButton
          key={type}
          value={type}
          className="toggle-pill"
          onClick={() => onToggleType(type)}
        >
          {LESSON_TYPE_LABELS[type]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  return (
    <div
      className="flex flex-col gap-1"
      data-help={
        "Werkzeuge zum Bewerten: erst ein Symbol" +
        (marks.length > 0 && !hideMarks ? " oder eine Note" : "") +
        " wählen, dann antippen. „Entschuldigt“ links, „Vorschlag“ am Ende der Symbole übernimmt das gestrichelte Symbol, „Löschen“ entfernt Symbol und Note." +
        (typeToggle
          ? " Hier bekommt die Stunde ihre Typen wie Klausur oder Projekt; ein zweiter Tipp entfernt einen."
          : "") +
        (hasBothMarks
          ? " Bei Nachklausur und Projekt am selben Tag wählt der Schalter, welche Note gesetzt wird."
          : "")
      }
    >
      {/* The symbols and marks in the middle, erasing at the right between both rows; only wide
          screens have room for the lesson type next to the tools */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="entschuldigt"
            aria-pressed={tool == "absent"}
            className={`w-16 ${buttonClass("absent")}`}
            onClick={() => onChange("absent")}
          >
            <GradeIcon size={32} />
            Entschuldigt
          </button>
          <div className="ml-2 max-[1169px]:hidden">{typeToggle}</div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <div
            className={
              symbols.length > 9
                ? "grid grid-cols-9 justify-items-center gap-0.5"
                : "flex items-center gap-1"
            }
          >
            {symbols.map(renderSymbol)}
          </div>
          {marks.length > 0 && !hideMarks && (
            <div className="flex flex-wrap items-center justify-center gap-1 self-stretch border-t border-line pt-1">
              {hasBothMarks && markTarget && onMarkTargetChange && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={markTarget}
                  onChange={(_, value: "mark" | "projectMark" | null) =>
                    value && onMarkTargetChange(value)
                  }
                  className="mr-2 rounded-full bg-brand-50 p-0.5"
                >
                  <ToggleButton value="mark" className="toggle-pill">
                    Nachklausur
                  </ToggleButton>
                  <ToggleButton value="projectMark" className="toggle-pill">
                    Projekt
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
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
                  <MarkBadge mark={getToolValue(option)} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end">
          {renderExtra("erase")}
        </div>
      </div>
      {typeToggle && (
        <div className="flex justify-center min-[1170px]:hidden">
          {typeToggle}
        </div>
      )}
    </div>
  );
}
