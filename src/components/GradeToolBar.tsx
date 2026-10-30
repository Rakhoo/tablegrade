import { Button } from "@mui/material";
import { GRADES, getGradeDefinition, type GradeTool } from "../lib/grades";
import { GradeIcon } from "./GradeIcon";
import { CommentIcon, TrashIcon } from "./icons";

const TOOL_EXTRAS: { tool: GradeTool; label: string }[] = [
  { tool: "erase", label: "Löschen" },
  { tool: "comment", label: "Kommentar" },
];

/** All tools in display order: the grade symbols, then erase and comment. */
const TOOLS: GradeTool[] = [
  ...GRADES.map((grade) => grade.key),
  ...TOOL_EXTRAS.map((extra) => extra.tool),
];

const toolLabel = (tool: GradeTool) =>
  getGradeDefinition(tool)?.label ??
  TOOL_EXTRAS.find((extra) => extra.tool == tool)!.label;

/** Round icon of a tool, matching the size of the grade badges. */
function ToolIcon({ tool, size }: { tool: GradeTool; size: number }) {
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
};

/** Toolbar of the grading mode: all tools stay open, so switching takes a single tap. */
export function GradeToolBar({ tool, onChange, onExit }: GradeToolBarProps) {
  return (
    <div className="card flex flex-wrap items-center justify-center gap-1 px-2 py-1.5">
      {TOOLS.map((option, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={option == tool}
          className={
            "flex w-16 flex-col items-center gap-0.5 rounded-2xl py-1 text-[10px] leading-tight font-medium whitespace-nowrap transition-transform active:scale-95 " +
            // Visual gap between the grade symbols and the extra tools
            (index == GRADES.length ? "ml-2 " : "") +
            (option == tool
              ? "bg-brand-100 text-ink ring-2 ring-brand-300"
              : "text-muted")
          }
          onClick={() => onChange(option)}
        >
          <ToolIcon tool={option} size={36} />
          {toolLabel(option)}
        </button>
      ))}
      <Button variant="contained" onClick={onExit} className="ml-2">
        Bewertung verlassen
      </Button>
    </div>
  );
}
