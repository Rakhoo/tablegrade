import type { ReactNode } from "react";
import { GradeToolButton } from "../../components/GradePicker";
import { GradeToolBar, LessonTypeButton } from "../../components/GradeToolBar";
import { CheckIcon } from "../../components/icons";
import type { SchoolClass } from "../../db";
import { formatClassName } from "../../lib/formatters";
import type { GradeTarget } from "../../lib/gradeTools";
import type { GradeTool, LessonType } from "../../lib/grades";
import type { ClassroomMode } from "../../lib/settings";
import { WarningLevels } from "./WarningLevels";

type ModeToolsProps = {
  mode: ClassroomMode;
  /** "rail": for the narrow side bar in landscape. */
  layout: "bar" | "rail";
  /** Grading with one tool button instead of all tools. */
  oneButton: boolean;
  tool: GradeTool;
  /** The field marks set when the lesson has a retake and a project. */
  markTarget: GradeTarget;
  onToolChange: (tool: GradeTool, target?: GradeTarget) => void;
  lessonTypes: LessonType[];
  availableTypes: LessonType[];
  onToggleType: (type: LessonType) => void;
  /** Hint of the comment and arrange modes. */
  hint?: ReactNode;
};

/** What the seating plan's mode shows: tools while grading, the levels while warning, else a hint. */
export function ModeTools({
  mode,
  layout,
  oneButton,
  tool,
  markTarget,
  onToolChange,
  lessonTypes,
  availableTypes,
  onToggleType,
  hint,
}: ModeToolsProps) {
  if (mode == "warn") return <WarningLevels />;
  if (mode != "grade") return hint;
  if (!oneButton) {
    return (
      <GradeToolBar
        layout={layout}
        tool={tool}
        onChange={onToolChange}
        lessonTypes={lessonTypes}
        availableTypes={availableTypes}
        onToggleType={onToggleType}
        markTarget={markTarget}
      />
    );
  }
  // The lesson type next to the button, below it in the side bar
  return (
    <div
      className={
        "flex min-w-0 flex-1 items-stretch gap-1.5 " +
        (layout == "rail" ? "flex-col" : "")
      }
    >
      <GradeToolButton
        tool={tool}
        markTarget={markTarget}
        onChange={onToolChange}
        lessonTypes={lessonTypes}
        className="h-12 flex-1"
      />
      <LessonTypeButton
        wide={layout == "rail"}
        lessonTypes={lessonTypes}
        availableTypes={availableTypes}
        onToggleType={onToggleType}
      />
    </div>
  );
}

type LessonTitleProps = {
  schoolClass: SchoolClass;
  /** Color of the class, as in the timetable. */
  accent: string;
  /** Badges of the lesson's types. */
  badges: ReactNode;
  /** Whether every student is graded, marked with a check. */
  complete: boolean;
};

/** Title of the seating plan: class and subject with the lesson's types and completion. */
export function LessonTitle({
  schoolClass,
  accent,
  badges,
  complete,
}: LessonTitleProps) {
  return (
    <>
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ background: accent }}
      />
      {/* Small screens wrap the title instead of cutting it */}
      <span className="truncate compact:whitespace-normal">
        {formatClassName(schoolClass)} · {schoolClass.subject}
      </span>
      {badges}
      {complete && (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: "#15803d" }}
          aria-label="Vollständig bewertet"
        >
          <CheckIcon size={15} strokeWidth={3} />
        </span>
      )}
    </>
  );
}
