import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { setLessonType, type GradeEntry } from "../db";
import { isReplacedByExam, type LessonType } from "../lib/grades";
import { LESSON_TYPE_LABELS } from "../lib/lessons";

type PendingChange = { date: string; type: LessonType; lost: number };

/**
 * Changes the type of a lesson, asking first if that deletes entries.
 * @returns The function to request a change and the confirmation dialog to render.
 */
export function useLessonTypeChange(
  classId: number | undefined,
  onDone: () => void,
) {
  const [pending, setPending] = useState<PendingChange | null>(null);

  const apply = async (date: string, type: LessonType) => {
    await setLessonType(classId!, date, type);
    onDone();
  };

  const request = (date: string, type: LessonType, entries: GradeEntry[]) => {
    const lost = entries.filter((entry) =>
      type == "exam"
        ? isReplacedByExam(entry.grade)
        : type == "normal" && entry.mark,
    ).length;
    if (lost > 0) setPending({ date, type, lost });
    else apply(date, type);
  };

  const dialog = pending && (
    <ConfirmDialog
      open
      title={`Zu „${LESSON_TYPE_LABELS[pending.type]}“ wechseln?`}
      confirmLabel="Wechseln"
      onClose={() => setPending(null)}
      onConfirm={() => apply(pending.date, pending.type)}
    >
      {pending.type == "exam"
        ? `Die ${pending.lost} vorhandenen Bewertungssymbole dieser Stunde werden gelöscht.`
        : `Die ${pending.lost} vorhandenen Noten dieser Stunde werden gelöscht.`}
    </ConfirmDialog>
  );

  return { requestLessonType: request, lessonTypeDialog: dialog };
}
