import {
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useState, type ChangeEvent } from "react";
import type { RosterEntry, Trait } from "../../db";
import { imageFileToDataUrl } from "../../lib/images";
import { getTraitColor } from "../../lib/traits";

type StudentDialogProps = {
  /** The edited student, `undefined` when adding a new one. */
  student?: RosterEntry;
  traits: Trait[];
  onSave: (student: RosterEntry) => void;
  onClose: () => void;
};

/** Edit form for name, nickname, photo and traits. Mount it only while open. */
export function StudentDialog({
  student,
  traits,
  onSave,
  onClose,
}: StudentDialogProps) {
  const [form, setForm] = useState<RosterEntry>(
    student ?? {
      firstName: "",
      lastName: "",
      nickname: null,
      image: null,
      traitIds: [],
    },
  );
  const update = (changes: Partial<RosterEntry>) =>
    setForm((prev) => ({ ...prev, ...changes }));

  const toggleTrait = (id: number) =>
    update({
      traitIds: form.traitIds.includes(id)
        ? form.traitIds.filter((traitId) => traitId != id)
        : [...form.traitIds, id],
    });

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) update({ image: await imageFileToDataUrl(file) });
    event.target.value = "";
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {student ? "Schüler bearbeiten" : "Neuer Schüler"}
      </DialogTitle>
      <DialogContent>
        <div className="flex gap-5 pt-1 portrait:flex-col portrait:items-center">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <Avatar
              src={form.image ?? undefined}
              alt=""
              sx={{ width: 112, height: 112 }}
            />
            <Button component="label" size="small">
              Bild wählen
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleImage}
              />
            </Button>
            {form.image && (
              <Button
                size="small"
                color="error"
                onClick={() => update({ image: null })}
              >
                Bild entfernen
              </Button>
            )}
          </div>
          <div className="flex w-full flex-col gap-4">
            <TextField
              autoFocus={!student}
              required
              label="Vorname"
              value={form.firstName}
              onChange={(event) => update({ firstName: event.target.value })}
            />
            <TextField
              label="Nachname"
              value={form.lastName}
              onChange={(event) => update({ lastName: event.target.value })}
            />
            <TextField
              label="Spitzname"
              helperText="Wird statt des Vornamens im Klassenzimmer angezeigt"
              value={form.nickname ?? ""}
              onChange={(event) =>
                update({ nickname: event.target.value || null })
              }
            />
          </div>
        </div>

        <h3 className="mt-5 mb-2 text-sm font-semibold tracking-wider text-muted uppercase">
          Eigenschaften
        </h3>
        <div className="flex flex-wrap gap-2">
          {traits.map((trait) => {
            const selected = form.traitIds.includes(trait.id);
            return (
              <Chip
                key={trait.id}
                label={trait.name}
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                aria-pressed={selected}
                icon={
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: getTraitColor(trait.name) }}
                  />
                }
                onClick={() => toggleTrait(trait.id)}
              />
            );
          })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onClose}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          disabled={!form.firstName.trim()}
          onClick={() =>
            onSave({
              ...form,
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              nickname: form.nickname?.trim() || null,
            })
          }
        >
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
