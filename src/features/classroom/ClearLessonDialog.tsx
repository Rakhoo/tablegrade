import { Checkbox, FormControlLabel } from "@mui/material";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { GradeEntry, LessonParts } from "../../db";

type ClearLessonDialogProps = {
  /** Entries of the lesson, used to count what each option would reset. */
  entries: GradeEntry[];
  /** Formatted lesson date shown in the text. */
  dateLabel: string;
  onConfirm: (parts: LessonParts) => void;
  onClose: () => void;
};

/**
 * Confirmation for resetting a lesson with a choice of what to reset.
 * Mount it only while open, the selection is initialized from the entries once.
 */
export function ClearLessonDialog({
  entries,
  dateLabel,
  onConfirm,
  onClose,
}: ClearLessonDialogProps) {
  const counts: Record<keyof LessonParts, number> = {
    warnings: entries.filter((entry) => entry.warnings > 0).length,
    grades: entries.filter((entry) => entry.grade).length,
    comments: entries.filter((entry) => entry.comment).length,
  };
  const options: { part: keyof LessonParts; label: string }[] = [
    { part: "warnings", label: "Ermahnungen" },
    { part: "grades", label: "Bewertungen" },
    { part: "comments", label: "Kommentare" },
  ];
  // Everything that exists is preselected
  const [parts, setParts] = useState<LessonParts>({
    warnings: counts.warnings > 0,
    grades: counts.grades > 0,
    comments: counts.comments > 0,
  });

  return (
    <ConfirmDialog
      open
      title="Stunde zurücksetzen?"
      confirmLabel="Zurücksetzen"
      confirmDisabled={!parts.warnings && !parts.grades && !parts.comments}
      onClose={onClose}
      onConfirm={() => onConfirm(parts)}
    >
      <p className="mb-2">
        Was soll für {dateLabel} gelöscht werden? Die Sitzordnung bleibt
        erhalten.
      </p>
      <div className="flex flex-col">
        {options.map(({ part, label }) => (
          <FormControlLabel
            key={part}
            disabled={counts[part] == 0}
            label={`${label} (${counts[part]})`}
            control={
              <Checkbox
                checked={parts[part]}
                onChange={(event) =>
                  setParts({ ...parts, [part]: event.target.checked })
                }
              />
            }
          />
        ))}
      </div>
    </ConfirmDialog>
  );
}
