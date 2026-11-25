import { useState, type PointerEvent } from "react";
import { useGradeFormat } from "../hooks/useGradeFormat";
import { useGradePickSections } from "../hooks/useGradePickSections";
import { useGradeToolSet, type MarkGroup } from "../hooks/useGradeToolSet";
import { fromPickKey, toPickKey, type GradeTarget } from "../lib/gradeTools";
import { getToolValue, type GradeTool, type LessonType } from "../lib/grades";
import { ToolIcon } from "./GradeToolBar";
import { OptionPicker, type PickRequest } from "./OptionPicker";

/** Name of a tool for the button, e.g. "Projekt 2+" or "Vorschlag". */
function useToolName(
  tool: GradeTool,
  target: GradeTarget | undefined,
  groups: MarkGroup[],
) {
  const formatGrade = useGradeFormat();
  if (tool == "suggestion") return "Vorschlag";
  if (tool == "absent") return "abwesend";
  if (tool == "erase") return "löschen";
  const value = getToolValue(tool);
  if (!tool.startsWith("mark:")) return `Mündlich ${formatGrade(value)}`;
  const group =
    groups.length > 1
      ? groups.find((candidate) => candidate.target == target)
      : groups[0];
  return `${group?.title ?? "Note"} ${formatGrade(value)}`;
}

type GradeToolButtonProps = {
  tool: GradeTool;
  /** The field marks set when the lesson has a retake and a project. */
  markTarget?: GradeTarget;
  onChange: (tool: GradeTool, target?: GradeTarget) => void;
  /** Types of the graded lesson; without them all tools (overview table). */
  lessonTypes?: LessonType[];
  hideMarks?: boolean;
  className?: string;
};

/**
 * The grading tool as one button: holding it opens all tools, sliding and releasing picks one;
 * a tap opens them to be tapped. Shows the current tool, so it is clear what a tap on a
 * student does.
 */
export function GradeToolButton({
  tool,
  markTarget,
  onChange,
  lessonTypes,
  hideMarks = false,
  className = "",
}: GradeToolButtonProps) {
  const sections = useGradePickSections(lessonTypes, hideMarks);
  const { markGroups } = useGradeToolSet(lessonTypes, hideMarks);
  const [request, setRequest] = useState<PickRequest | null>(null);
  const isMark = tool.startsWith("mark:");
  const target = isMark && markGroups.length > 1 ? markTarget : undefined;
  const name = useToolName(tool, target, markGroups);

  const open = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button != 0) return;
    setRequest({
      anchor: event.currentTarget.getBoundingClientRect(),
      title: "Werkzeug",
      sections,
      selected: toPickKey(tool, target),
      held: true,
      onPick: (key) => {
        const picked = fromPickKey(key);
        onChange(picked.tool, picked.target);
      },
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Werkzeug: ${name}. Halten oder tippen zum Wechseln.`}
        aria-haspopup="dialog"
        className={
          "flex min-w-0 touch-none items-center justify-center gap-2 rounded-2xl bg-brand-100 px-3 text-ink ring-2 ring-brand-300 transition-transform select-none active:scale-95 " +
          className
        }
        style={{ WebkitTouchCallout: "none" }}
        data-help="Werkzeug zum Bewerten: halten, auf ein Symbol gleiten und loslassen wählt es, ebenso Tippen und Antippen. Danach vergibt ein Tipp auf einen Schüler das Werkzeug."
        onPointerDown={open}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="flex shrink-0 items-center">
          <ToolIcon tool={tool} size={30} />
        </span>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-[11px] text-muted">
            Halten: wechseln
          </span>
        </span>
      </button>
      {request && (
        <OptionPicker request={request} onClose={() => setRequest(null)} />
      )}
    </>
  );
}
