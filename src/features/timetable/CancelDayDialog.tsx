import { Checkbox, FormControlLabel } from "@mui/material";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { countEntriesOn, setDayCancelled } from "../../db";
import { toIsoDate } from "../../lib/dates";

type CancelDayDialogProps = {
  date: Date;
  /** Whether the day is already cancelled, i.e. the dialog makes it regular again. */
  isCancelled: boolean;
  onClose: () => void;
  /** Called after the day was changed. */
  onChanged: () => void;
};

/**
 * Confirmation for marking a day as "Ausfall" or regular again. If the day already has
 * entries, they are deleted on cancelling, which needs an extra confirmation checkbox.
 * Mount it only while open.
 */
export function CancelDayDialog({
  date,
  isCancelled,
  onClose,
  onChanged,
}: CancelDayDialogProps) {
  const iso = toIsoDate(date);
  const [existing, setExisting] = useState<{
    entries: number;
    classes: number;
  } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!isCancelled) countEntriesOn(iso).then(setExisting);
  }, [iso, isCancelled]);

  const hasEntries = !!existing && existing.entries > 0;
  const dateLabel = format(date, "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <ConfirmDialog
      open
      title={isCancelled ? "Ausfall aufheben?" : "Tag als Ausfall markieren?"}
      confirmLabel={isCancelled ? "Wieder regulär" : "Als Ausfall markieren"}
      confirmColor={hasEntries ? "error" : "primary"}
      // Wait for the check of existing entries before cancelling is possible
      confirmDisabled={
        !isCancelled && (!existing || (hasEntries && !acknowledged))
      }
      onClose={onClose}
      onConfirm={async () => {
        await setDayCancelled(iso, !isCancelled);
        onChanged();
      }}
    >
      <p>
        {isCancelled
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
            `An diesem Tag gibt es bereits ${existing.entries} ` +
            `${existing.entries == 1 ? "Eintrag" : "Einträge"} in ` +
            `${existing.classes} ${existing.classes == 1 ? "Klasse" : "Klassen"}. ` +
            "Ich bestätige, dass diese gelöscht werden."
          }
        />
      )}
    </ConfirmDialog>
  );
}
