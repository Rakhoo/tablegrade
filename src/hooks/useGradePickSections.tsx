import { ExtraToolIcon, ToolIcon } from "../components/GradeToolBar";
import { GradeIcon } from "../components/GradeIcon";
import type { PickOption, PickSection } from "../components/OptionPicker";
import { toPickKey, type GradeTarget } from "../lib/gradeTools";
import { getToolValue, type GradeTool, type LessonType } from "../lib/grades";
import { useGradeFormat } from "./useGradeFormat";
import { useGradeToolSet, type MarkGroup } from "./useGradeToolSet";

/** The marks in a grid: one column per grade, "+" above and "−" below; there is no "6+" or "6−". */
const MARK_ROWS = [
  [0.7, 1.7, 2.7, 3.7, 4.7, null],
  [1, 2, 3, 4, 5, 6],
  [1.3, 2.3, 3.3, 4.3, 5.3, null],
];

/**
 * The grading tools of a lesson as sections of a picker: oral symbols with the suggestion, the
 * marks once per kind (side by side when there is room), and "abwesend" and erasing.
 */
export function useGradePickSections(
  lessonTypes: LessonType[] | undefined,
  hideMarks = false,
): PickSection[] {
  const formatGrade = useGradeFormat();
  const { symbols, markGroups } = useGradeToolSet(lessonTypes, hideMarks);
  const option = (
    tool: GradeTool,
    label: string,
    target?: GradeTarget,
  ): PickOption => ({
    key: toPickKey(tool, target),
    label,
    content: <ToolIcon tool={tool} size={30} />,
  });
  const sections: PickSection[] = [];
  if (symbols.length > 0) {
    sections.push({
      key: "oral",
      title: "Mündlich",
      // One row, or two when many symbols are shown
      columns:
        symbols.length <= 8 ? symbols.length : Math.ceil(symbols.length / 2),
      full: true,
      options: symbols.map((tool) =>
        option(
          tool,
          tool == "suggestion" ? "Vorschlag" : formatGrade(getToolValue(tool)),
        ),
      ),
    });
  }
  sections.push(
    ...markGroups.map(({ target, title }: MarkGroup) => ({
      key: `marks-${target ?? "all"}`,
      title,
      columns: 6,
      options: MARK_ROWS.flat().map((mark) =>
        mark == null ? null : option(`mark:${mark}`, formatGrade(mark), target),
      ),
    })),
  );
  sections.push({
    key: "other",
    columns: 2,
    full: true,
    stretch: true,
    options: [
      {
        key: "absent",
        label: "abwesend",
        content: (
          <>
            <GradeIcon size={24} />
            abwesend
          </>
        ),
      },
      {
        key: "erase",
        label: "löschen",
        danger: true,
        content: (
          <>
            <ExtraToolIcon tool="erase" size={24} />
            löschen
          </>
        ),
      },
    ],
  });
  return sections;
}
