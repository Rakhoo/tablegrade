import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { setLessonTypes, type GradeEntry } from "../db";
import { isExamDay, MARK_KIND, type LessonType } from "../lib/grades";
import { toggleLessonType } from "../lib/lessons";

type PendingChange = { date: string; types: LessonType[]; lost: string[] };

/**
 * Toggles a type of a lesson (see `toggleLessonType`), asking first if that deletes entries.
 * @returns The function to request a change and the confirmation dialog to render.
 */
export function useLessonTypeChange(
  classId: number | undefined,
  onDone: () => void,
) {
  const [pending, setPending] = useState<PendingChange | null>(null);

  const apply = async (date: string, types: LessonType[]) => {
    await setLessonTypes(classId!, date, types);
    onDone();
  };

  /**
   * @param current The lesson's types now.
   * @param entries The lesson's entries, to count what the change would delete.
   */
  const request = (
    date: string,
    current: LessonType[],
    type: LessonType,
    entries: GradeEntry[],
  ) => {
    const types = toggleLessonType(current, type);
    const kinds = new Set(types.map((other) => MARK_KIND[other]));
    const count = (has: (entry: GradeEntry) => boolean) =>
      entries.filter(has).length;
    const lost = [
      isExamDay(types) && count((entry) => entry.grade != null),
      !kinds.has("exam") && count((entry) => entry.mark != null),
      !kinds.has("project") && count((entry) => entry.projectMark != null),
    ];
    const labels = ["Bewertungssymbole", "Klausurnoten", "Projektnoten"];
    const texts = lost.flatMap((number, index) =>
      number ? [`${number} ${labels[index]}`] : [],
    );
    if (texts.length > 0) setPending({ date, types, lost: texts });
    else apply(date, types);
  };

  const dialog = pending && (
    <ConfirmDialog
      open
      title="Stundentyp ändern?"
      confirmLabel="Ändern"
      onClose={() => setPending(null)}
      onConfirm={() => apply(pending.date, pending.types)}
    >
      {`Dabei werden ${pending.lost.join(" und ")} dieser Stunde gelöscht.`}
    </ConfirmDialog>
  );

  return { requestLessonType: request, lessonTypeDialog: dialog };
}
