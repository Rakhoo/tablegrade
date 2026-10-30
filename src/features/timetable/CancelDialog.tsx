import { Checkbox, FormControlLabel } from "@mui/material";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  countEntriesOn,
  setDayCancelled,
  setLessonCancelled,
  type SchoolClass,
} from "../../db";
import { toIsoDate } from "../../lib/dates";
import { formatClassName } from "../../lib/formatters";

type CancelDialogProps = {
  date: Date;
  /** The lesson to cancel; without one the dialog applies to the whole day. */
  schoolClass?: SchoolClass;
  /** Whether it is already cancelled, i.e. the dialog makes it regular again. */
  isCancelled: boolean;
  onClose: () => void;
  /** Called after the day or lesson was changed. */
  onChanged: () => void;
};

/**
 * Confirmation for marking a day or lesson as "Ausfall" or regular again. Existing entries
 * are deleted on cancelling, which needs an extra confirmation checkbox.
 * Mount it only while open.
 */
export function CancelDialog({
  date,
  schoolClass,
  isCancelled,
  onClose,
  onChanged,
}: CancelDialogProps) {
  const iso = toIsoDate(date);
  const classId = schoolClass?.id;
  const [existing, setExisting] = useState<{
    entries: number;
    classes: number;
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!isCancelled) countEntriesOn(iso, classId).then(setExisting);
  }, [iso, classId, isCancelled]);

  const hasEntries = !!existing && existing.entries > 0;
  const dateLabel = format(date, "EEEE, d. MMMM yyyy", { locale: de });
  const lessonLabel =
    schoolClass &&
    `${formatClassName(schoolClass)} ${schoolClass.subject} am ${dateLabel}`;
  const noun = schoolClass ? "Stunde" : "Tag";

  return (
    <ConfirmDialog
      open
      title={
        isCancelled ? "Ausfall aufheben?" : `${noun} als Ausfall markieren?`
      }
      confirmLabel={isCancelled ? "Wieder regulär" : "Als Ausfall markieren"}
      confirmColor={hasEntries ? "error" : "primary"}
      // Wait for the check of existing entries before cancelling is possible
      confirmDisabled={
        !isCancelled && (!existing || (hasEntries && !acknowledged))
      }
      onClose={onClose}
      onConfirm={async () => {
        if (classId) await setLessonCancelled(classId, iso, !isCancelled);
        else await setDayCancelled(iso, !isCancelled);
        onChanged();
      }}
    >
      <p>
        {schoolClass
          ? isCancelled
            ? `${lessonLabel} findet wieder regulär statt.`
            : `${lessonLabel} fällt aus. Diese Stunde wird nicht bewertet.`
          : isCancelled
            ? `Am ${dateLabel} findet wieder regulärer Unterricht statt.`
            : `Am ${dateLabel} findet kein Unterricht statt, z. B. wegen Krankheit oder eines Brückentags. An diesem Tag wird nicht bewertet.`}
      </p>
      {hasEntries && (
        <FormControlLabel
          className="mt-3 rounded-2xl bg-red-50 py-1 pr-3"
          control={
            <Checkbox
              color="error"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
          }
          label={
            `${schoolClass ? "In dieser Stunde" : "An diesem Tag"} gibt es bereits ` +
            `${existing.entries} ${existing.entries == 1 ? "Eintrag" : "Einträge"}` +
            (schoolClass
              ? ""
              : ` in ${existing.classes} ${existing.classes == 1 ? "Klasse" : "Klassen"}`) +
            ". Ich bestätige, dass diese gelöscht werden."
          }
        />
      )}
    </ConfirmDialog>
  );
}
