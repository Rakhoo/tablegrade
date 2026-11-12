import { Button, Chip, IconButton, Menu, TextField } from "@mui/material";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DutyBadge, DutySymbol } from "../../components/dutySymbols";
import { CheckIcon, TrashIcon } from "../../components/icons";
import { countDutyUses, deleteDuty, saveDuty, type Duty } from "../../db";
import {
  DUTY_COLORS,
  DUTY_SYMBOL_KEYS,
  MAX_DUTY_NAME_LENGTH,
  SUGGESTED_DUTIES,
} from "../../lib/duties";
import { SettingsSection } from "./SettingsSection";

type DutySettingsProps = { duties: Duty[] };

/** Class duties: name, symbol and color; usual duties can be added with one tap. */
export function DutySettings({ duties }: DutySettingsProps) {
  const { revalidate } = useRevalidator();
  const [newName, setNewName] = useState("");
  const [symbolMenu, setSymbolMenu] = useState<{
    duty: Duty;
    anchor: HTMLElement;
  } | null>(null);
  const [removing, setRemoving] = useState<{
    duty: Duty;
    uses: number;
  } | null>(null);
  const suggestions = SUGGESTED_DUTIES.filter(
    (suggestion) => !duties.some((duty) => duty.name == suggestion.name),
  );

  const save = async (duty: Omit<Duty, "id"> & { id?: number }) => {
    await saveDuty(duty);
    revalidate();
  };

  /** Adds a duty with the first symbol and color no other duty has yet. */
  const add = async () => {
    const unused = <T,>(options: readonly T[], field: "symbol" | "color") =>
      options.find((option) => !duties.some((duty) => duty[field] == option)) ??
      options[0];
    await save({
      name: newName.trim(),
      symbol: unused(DUTY_SYMBOL_KEYS, "symbol"),
      color: unused(DUTY_COLORS, "color"),
    });
    setNewName("");
  };

  const remove = async (duty: Duty) => {
    await deleteDuty(duty.id);
    revalidate();
  };

  return (
    <SettingsSection
      help="Dienste, die Schülern einer Klasse gegeben werden können, mit Symbol und Farbe."
      title="Dienste"
      hint="Erscheinen als farbiges Symbol oben links am Platz im Sitzplan. Vergeben werden sie in der Schülerliste einer Klasse."
    >
      {duties.map((duty) => (
        <div key={duty.id} className="flex flex-wrap items-center gap-2">
          <IconButton
            aria-label={`Symbol von ${duty.name}`}
            onClick={(event) =>
              setSymbolMenu({ duty, anchor: event.currentTarget })
            }
            className="p-1"
          >
            <DutyBadge duty={duty} size={32} />
          </IconButton>
          <TextField
            size="small"
            key={duty.name}
            defaultValue={duty.name}
            aria-label="Name des Dienstes"
            className="w-56"
            slotProps={{ htmlInput: { maxLength: MAX_DUTY_NAME_LENGTH } }}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name != duty.name) save({ ...duty, name });
            }}
          />
          <div className="flex flex-wrap gap-1">
            {DUTY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Farbe ${color}`}
                aria-pressed={color == duty.color}
                onClick={() => save({ ...duty, color })}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background: color }}
              >
                {color == duty.color && <CheckIcon size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>
          <IconButton
            color="error"
            aria-label={`${duty.name} löschen`}
            className="ml-auto"
            onClick={async () => {
              const uses = await countDutyUses(duty.id);
              if (uses > 0) setRemoving({ duty, uses });
              else remove(duty);
            }}
          >
            <TrashIcon size={18} />
          </IconButton>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <TextField
          size="small"
          label="Neuer Dienst"
          value={newName}
          className="w-56"
          onChange={(event) => setNewName(event.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_DUTY_NAME_LENGTH } }}
        />
        <Button variant="outlined" disabled={!newName.trim()} onClick={add}>
          Hinzufügen
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted">Vorschläge:</span>
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion.name}
              label={suggestion.name}
              variant="outlined"
              avatar={<DutyBadge duty={suggestion} size={24} />}
              onClick={() => save(suggestion)}
            />
          ))}
        </div>
      )}

      <Menu
        anchorEl={symbolMenu?.anchor}
        open={!!symbolMenu}
        onClose={() => setSymbolMenu(null)}
      >
        <div className="grid grid-cols-4 gap-1 px-2">
          {DUTY_SYMBOL_KEYS.map((symbol) => (
            <IconButton
              key={symbol}
              aria-label={`Symbol ${symbol}`}
              aria-pressed={symbol == symbolMenu?.duty.symbol}
              className={
                symbol == symbolMenu?.duty.symbol ? "bg-brand-100" : ""
              }
              onClick={() => {
                if (symbolMenu) save({ ...symbolMenu.duty, symbol });
                setSymbolMenu(null);
              }}
            >
              <DutySymbol symbol={symbol} size={22} />
            </IconButton>
          ))}
        </div>
      </Menu>

      {removing && (
        <ConfirmDialog
          open
          title={`„${removing.duty.name}“ löschen?`}
          onClose={() => setRemoving(null)}
          onConfirm={() => remove(removing.duty)}
        >
          {removing.uses} Schüler haben diesen Dienst und verlieren ihn.
        </ConfirmDialog>
      )}
    </SettingsSection>
  );
}
