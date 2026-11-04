import { Button, IconButton, TextField } from "@mui/material";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CheckIcon, TrashIcon } from "../../components/icons";
import { countTraitUses, deleteTrait, saveTrait, type Trait } from "../../db";
import { SettingsSection } from "./SettingsSection";

/** Longest name, which still fits into lists and chips. */
const MAX_NAME_LENGTH = 12;
/** Most traits that fit as dots around a photo. */
const MAX_TRAITS = 12;

/** Colors for the dots, chosen to be easy to tell apart. */
const TRAIT_COLORS = [
  "#4f46e5",
  "#38bdf8",
  "#14b8a6",
  "#475569",
  "#ec4899",
  "#a855f7",
  "#84cc16",
  "#b45309",
  "#0ea5e9",
  "#10b981",
  "#f472b6",
  "#7c3aed",
  "#65a30d",
  "#92400e",
  "#0f766e",
  "#be185d",
];

type TraitSettingsProps = { traits: Trait[] };

/** Student properties: free name and a color no other trait uses. */
export function TraitSettings({ traits }: TraitSettingsProps) {
  const { revalidate } = useRevalidator();
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<{
    trait: Trait;
    uses: number;
  } | null>(null);

  const isTaken = (color: string, trait?: Trait) =>
    traits.some((other) => other.color == color && other.id != trait?.id);

  const update = async (trait: Trait, changes: Partial<Trait>) => {
    await saveTrait({ ...trait, ...changes });
    revalidate();
  };

  const add = async () => {
    const color = TRAIT_COLORS.find((option) => !isTaken(option));
    if (!color) return;
    await saveTrait({ name: newName.trim(), color });
    setNewName("");
    revalidate();
  };

  const remove = async (trait: Trait) => {
    await deleteTrait(trait.id);
    revalidate();
  };

  return (
    <SettingsSection
      help="Eigenschaften, die Schülern zugewiesen werden können, mit ihren Farben."
      title="Schülereigenschaften"
      hint="Erscheinen als farbige Punkte im Sitzplan. Jede Farbe gibt es nur einmal."
    >
      {traits.map((trait) => (
        <div key={trait.id} className="flex flex-wrap items-center gap-2">
          <TextField
            size="small"
            key={trait.name}
            defaultValue={trait.name}
            aria-label="Name der Eigenschaft"
            className="w-40"
            slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name != trait.name) update(trait, { name });
            }}
          />
          <div className="flex flex-wrap gap-1">
            {TRAIT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Farbe ${color}`}
                aria-pressed={color == trait.color}
                disabled={isTaken(color, trait)}
                onClick={() => update(trait, { color })}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white disabled:opacity-20"
                style={{ background: color }}
              >
                {color == trait.color && (
                  <CheckIcon size={14} strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
          <IconButton
            color="error"
            aria-label={`${trait.name} löschen`}
            className="ml-auto"
            onClick={async () => {
              const uses = await countTraitUses(trait.id);
              if (uses > 0) setRemoving({ trait, uses });
              else remove(trait);
            }}
          >
            <TrashIcon size={18} />
          </IconButton>
        </div>
      ))}

      {traits.length < MAX_TRAITS && (
        <div className="flex items-center gap-2">
          <TextField
            size="small"
            label="Neue Eigenschaft"
            value={newName}
            className="w-52"
            onChange={(event) => setNewName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
          />
          <Button variant="outlined" disabled={!newName.trim()} onClick={add}>
            Hinzufügen
          </Button>
        </div>
      )}

      {removing && (
        <ConfirmDialog
          open
          title={`„${removing.trait.name}“ löschen?`}
          onClose={() => setRemoving(null)}
          onConfirm={() => remove(removing.trait)}
        >
          {removing.uses} Schüler haben diese Eigenschaft und verlieren sie.
        </ConfirmDialog>
      )}
    </SettingsSection>
  );
}
