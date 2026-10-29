import { ButtonBase, Popover } from "@mui/material";
import { useState } from "react";
import { GradeIcon } from "../../components/GradeIcon";
import { CommentIcon, TrashIcon } from "../../components/icons";
import { getGradeDefinition, GRADES, type GradeKey } from "../../lib/grades";

/** What a tap on a student does while grading: set a symbol, remove it, or edit the comment. */
export type GradeTool = GradeKey | "erase" | "comment";

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

type GradeToolSelectProps = {
  tool: GradeTool;
  onChange: (tool: GradeTool) => void;
};

/** Button showing the active grading tool; tapping it opens the choice of all tools. */
export function GradeToolSelect({ tool, onChange }: GradeToolSelectProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <ButtonBase
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-label={`Werkzeug: ${toolLabel(tool)}`}
        className="flex items-center gap-2 rounded-full bg-surface py-1 pr-4 pl-1 font-semibold shadow-tile"
      >
        <ToolIcon tool={tool} size={34} />
        {toolLabel(tool)}
      </ButtonBase>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { className: "mt-2" } }}
      >
        <div className="flex gap-1.5 p-3">
          {TOOLS.map((option, index) => (
            <button
              key={option}
              type="button"
              className={
                "flex w-20 flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-xs font-medium transition-transform active:scale-95 " +
                // Visual gap between the grade symbols and the extra tools
                (index == GRADES.length ? "ml-3 " : "") +
                (option == tool
                  ? "bg-brand-100 text-ink ring-2 ring-brand-300"
                  : "text-muted active:bg-brand-50")
              }
              onClick={() => {
                onChange(option);
                setAnchor(null);
              }}
            >
              <ToolIcon tool={option} size={52} />
              {toolLabel(option)}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
