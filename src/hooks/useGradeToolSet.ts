import type { GradeTarget } from "../lib/gradeTools";
import {
  getGradeTools,
  isExamDay,
  MARK_KIND,
  type GradeTool,
  type LessonType,
} from "../lib/grades";
import { getVisibleGrades } from "../lib/settings";
import { useSettings } from "./useSettings";

/** The marks of one kind, e.g. of a retake, with the field they set. */
export type MarkGroup = {
  /** The field the marks set; without one the tapped column decides (overview table). */
  target?: GradeTarget;
  title: string;
};

/**
 * The grading tools offered for a lesson: oral symbols (with the suggestion), and the marks
 * once per kind the lesson takes, so a retake and a project on one day get both side by side.
 * @param lessonTypes Types of the lesson; without them all tools (overview table).
 * @param hideMarks Leaves the marks out, e.g. in an overview without special lessons.
 */
export function useGradeToolSet(
  lessonTypes: LessonType[] | undefined,
  hideMarks = false,
) {
  const settings = useSettings();
  const { grades, marks } = getGradeTools(
    getVisibleGrades(settings),
    lessonTypes,
  );
  // The suggestion ends the symbols; exams have none, so there is nothing to suggest
  const offersSuggestion =
    (!lessonTypes || !isExamDay(lessonTypes)) && settings.suggestions;
  const symbols: GradeTool[] = [
    ...grades,
    ...(offersSuggestion ? (["suggestion"] as const) : []),
  ];
  return {
    symbols,
    offersSuggestion,
    marks: hideMarks ? [] : marks,
    markGroups:
      hideMarks || marks.length == 0 ? [] : getMarkGroups(lessonTypes),
  };
}

/** The kinds of marks a lesson takes, each with its title. */
function getMarkGroups(lessonTypes: LessonType[] | undefined): MarkGroup[] {
  if (!lessonTypes) return [{ title: "Noten" }];
  if (isExamDay(lessonTypes)) return [{ target: "mark", title: "Klausur" }];
  const groups: MarkGroup[] = [];
  if (lessonTypes.includes("retake"))
    groups.push({ target: "mark", title: "Nachklausur" });
  if (lessonTypes.some((type) => MARK_KIND[type] == "project"))
    groups.push({ target: "projectMark", title: "Projekt" });
  return groups;
}
