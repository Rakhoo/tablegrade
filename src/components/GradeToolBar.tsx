import { Popover, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { getToolValue, type GradeTool, type LessonType } from "../lib/grades";
import type { GradeTarget } from "../lib/gradeTools";
import { useGradeFormat } from "../hooks/useGradeFormat";
import { useGradeToolSet, type MarkGroup } from "../hooks/useGradeToolSet";
import { LESSON_TYPE_LABELS, LESSON_TYPE_ORDER } from "../lib/lessons";
import { GradeIcon } from "./GradeIcon";
import { NibIcon, TrashIcon } from "./icons";
import { MarkBadge } from "./MarkBadge";

type ExtraTool = "suggestion" | "erase";

const EXTRA_LABELS: Record<ExtraTool, string> = {
  suggestion: "Vorschlag",
  erase: "Löschen",
};

/** Round icon of a tool that is no grade. */
export function ExtraToolIcon({
  tool,
  size,
}: {
  tool: ExtraTool;
  size: number;
}) {
  if (tool == "suggestion") {
    return (
      <span
        className="flex items-center justify-center rounded-full border-2 border-dashed border-brand-500 bg-brand-50 text-brand-600"
        style={{ width: size, height: size }}
      >
        <NibIcon size={size * 0.6} />
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

/** Symbol of a tool: its grade symbol, mark badge or icon. */
export function ToolIcon({ tool, size }: { tool: GradeTool; size: number }) {
  if (tool == "suggestion" || tool == "erase")
    return <ExtraToolIcon tool={tool} size={size} />;
  if (tool == "absent") return <GradeIcon size={size} />;
  if (tool.startsWith("mark:"))
    return <MarkBadge mark={getToolValue(tool)} size={size * 0.8} />;
  return <GradeIcon grade={getToolValue(tool)} size={size} />;
}

type GradeToolBarProps = {
  tool: GradeTool;
  /** Called with the tool, and for a mark with the field it sets when the lesson has two. */
  onChange: (tool: GradeTool, target?: GradeTarget) => void;
  /** Types of the graded lesson; without them all tools are offered (overview table). */
  lessonTypes?: LessonType[];
  /** The types the lesson can get now, follow-ups only after an incomplete exam or project. */
  availableTypes?: LessonType[];
  /** Adds or removes a type of the graded lesson. */
  onToggleType?: (type: LessonType) => void;
  /** Which mark the marks set, when the lesson has a retake and a project. */
  markTarget?: GradeTarget;
  /** Hides the marks when no lesson can take them (overview without special lessons). */
  hideMarks?: boolean;
  /** "rail": stacked and wrapped for the narrow side bar of the seating plan in landscape. */
  layout?: "bar" | "rail";
};

/**
 * Tools of the grading mode: all stay open, so switching takes a single tap. Classic marks
 * get their own row per kind, shown for exams, retakes and projects; a retake and a project on
 * one day get one row each, so no switch decides which mark is set.
 */
export function GradeToolBar({
  tool,
  onChange,
  lessonTypes,
  availableTypes,
  onToggleType,
  markTarget,
  hideMarks = false,
  layout = "bar",
}: GradeToolBarProps) {
  const formatGrade = useGradeFormat();
  const { symbols, offersSuggestion, marks, markGroups } = useGradeToolSet(
    lessonTypes,
    hideMarks,
  );
  const rail = layout == "rail";
  const twoKinds = markGroups.length > 1;

  const buttonClass = (active: boolean) =>
    "flex flex-col items-center gap-0.5 rounded-2xl p-1 text-[10px] leading-tight font-medium whitespace-nowrap transition-transform active:scale-95 " +
    (active ? "bg-brand-100 text-ink ring-2 ring-brand-300" : "text-muted");

  const renderExtra = (option: ExtraTool | "absent") => (
    <button
      key={option}
      type="button"
      aria-label={option == "absent" ? "abwesend" : EXTRA_LABELS[option]}
      aria-pressed={option == tool}
      data-help={
        option == "absent"
          ? "Markiert als abwesend."
          : "Löscht Symbol und Noten."
      }
      className={`w-16 ${buttonClass(option == tool)}`}
      onClick={() => onChange(option)}
    >
      {option == "absent" ? (
        <GradeIcon size={32} />
      ) : (
        <ExtraToolIcon tool={option} size={32} />
      )}
      {option == "absent" ? "Abwesend" : EXTRA_LABELS[option]}
    </button>
  );

  // With all grades enabled the symbols form two rows
  const symbolSize = symbols.length > 9 || rail ? 32 : 40;
  const renderSymbol = (option: GradeTool) => (
    <button
      key={option}
      type="button"
      aria-label={
        option == "suggestion"
          ? EXTRA_LABELS.suggestion
          : formatGrade(getToolValue(option))
      }
      aria-pressed={option == tool}
      className={buttonClass(option == tool)}
      onClick={() => onChange(option)}
    >
      {option == "suggestion" ? (
        <ExtraToolIcon tool="suggestion" size={symbolSize} />
      ) : (
        <GradeIcon grade={getToolValue(option)} size={symbolSize} />
      )}
    </button>
  );

  /** One row of marks; with two kinds labeled, as a tap sets the mark of its own kind. */
  const renderMarks = ({ target, title }: MarkGroup) => (
    <div
      key={target ?? "all"}
      className={
        "flex items-center justify-center gap-1 " +
        (rail ? "flex-col" : "flex-wrap")
      }
    >
      {twoKinds && (
        <span className="w-24 text-center text-xs font-semibold text-muted">
          {title}
        </span>
      )}
      <div
        className={
          rail
            ? "grid grid-cols-6 gap-0.5"
            : "flex flex-wrap justify-center gap-1"
        }
      >
        {marks.map((option) => {
          const active = option == tool && (!twoKinds || target == markTarget);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              aria-label={
                twoKinds
                  ? `${title} ${formatGrade(getToolValue(option))}`
                  : undefined
              }
              className={
                "flex h-8 w-9 items-center justify-center rounded-xl transition-transform active:scale-95 " +
                (active ? "bg-brand-100 ring-2 ring-brand-300" : "")
              }
              onClick={() => onChange(option, target)}
            >
              <MarkBadge mark={getToolValue(option)} />
            </button>
          );
        })}
      </div>
    </div>
  );

  // Not exclusive: a lesson can be a retake and a project; a second tap removes a type
  const typeToggle = lessonTypes && onToggleType && (
    <LessonTypeToggle
      lessonTypes={lessonTypes}
      availableTypes={availableTypes}
      onToggleType={onToggleType}
    />
  );

  const symbolRow = (
    <div
      className={
        symbols.length > 9 && !rail
          ? "grid grid-cols-9 justify-items-center gap-0.5"
          : "flex flex-wrap items-center justify-center gap-1"
      }
      data-help={
        "Symbole der mündlichen Bewertung." +
        (offersSuggestion
          ? " „Vorschlag“ übernimmt das gestrichelte Symbol."
          : "")
      }
    >
      {symbols.map(renderSymbol)}
    </div>
  );
  const markRows = markGroups.length > 0 && (
    <div
      className="flex flex-col gap-1 self-stretch border-t border-line pt-1"
      data-help="Noten für Klausur, Nachklausur und Projekt."
    >
      {markGroups.map(renderMarks)}
    </div>
  );

  if (rail) {
    return (
      <div
        className="flex flex-col items-center gap-2"
        data-help-group
        data-help="Werkzeuge zum Bewerten: erst wählen, dann antippen."
      >
        <div className="flex gap-1">
          {renderExtra("absent")}
          {renderExtra("erase")}
        </div>
        {symbolRow}
        {markRows}
        {typeToggle}
      </div>
    );
  }
  return (
    <div
      className="flex flex-col gap-1"
      data-help-group
      data-help="Werkzeuge zum Bewerten: erst wählen, dann antippen."
    >
      {/* The symbols and marks in the middle, erasing at the right between both rows; only wide
          screens have room for the lesson type next to the tools */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex items-center gap-1">
          {renderExtra("absent")}
          <div className="ml-2 max-[1169px]:hidden">{typeToggle}</div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1">
          {symbolRow}
          {markRows}
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

type LessonTypeToggleProps = {
  lessonTypes: LessonType[];
  availableTypes?: LessonType[];
  onToggleType: (type: LessonType) => void;
};

/** The types of a lesson as toggle buttons; a second tap removes a type. */
export function LessonTypeToggle({
  lessonTypes,
  availableTypes,
  onToggleType,
}: LessonTypeToggleProps) {
  return (
    <ToggleButtonGroup
      size="small"
      color="primary"
      value={lessonTypes}
      className="flex-wrap justify-center rounded-full bg-brand-50 p-0.5"
      data-help="Typ der Stunde, z. B. Klausur oder Projekt; ein zweiter Tipp entfernt ihn."
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
}

/**
 * The types of a lesson behind one small button, for the tool button of small screens; a tap
 * shows the toggles.
 */
export function LessonTypeButton({
  wide = false,
  ...props
}: LessonTypeToggleProps & {
  /** In a row of its own: the types side by side. */
  wide?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { lessonTypes } = props;
  return (
    <>
      <button
        type="button"
        className={
          "flex shrink-0 items-center justify-center gap-1 rounded-2xl bg-blush-100 px-2.5 text-xs leading-tight font-semibold text-ink transition-transform active:scale-95 " +
          (wide ? "min-h-8 flex-wrap" : "flex-col")
        }
        data-help="Typ der Stunde, z. B. Klausur oder Projekt."
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {lessonTypes.length > 0 ? (
          lessonTypes.map((type) => (
            <span key={type}>{LESSON_TYPE_LABELS[type]}</span>
          ))
        ) : (
          <span>{wide ? "Typ der Stunde" : "Typ"}</span>
        )}
      </button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { className: "p-3" } }}
      >
        <LessonTypeToggle {...props} />
      </Popover>
    </>
  );
}
