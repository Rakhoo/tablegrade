import { Autocomplete, Button, TextField } from "@mui/material";
import { useState } from "react";
import type { SchoolClass } from "../../db";
import { filterCopyClasses, getCopyLabel } from "../../lib/classCopy";

type RosterToolsProps = {
  /** Number of students in the roster. */
  count: number;
  /** The other classes students can be copied from, in the order they are offered. */
  classes: SchoolClass[];
  /** The edited class, whose level and letter decide the suggested classes to copy from. */
  target: Pick<SchoolClass, "number" | "letter" | "year">;
  levels: string[];
  importing: boolean;
  onCopy: (source: SchoolClass) => void;
  /** Reads the chosen WebUntis PDF. */
  onImport: (input: HTMLInputElement) => void;
  /** Opens or closes the field for pasting a list. */
  onPaste: () => void;
  onAdd: () => void;
};

/** Heading of the roster with the ways to fill it: copy, WebUntis PDF, pasted list, by hand. */
export function RosterTools({
  count,
  classes,
  target,
  levels,
  importing,
  onCopy,
  onImport,
  onPaste,
  onAdd,
}: RosterToolsProps) {
  const [search, setSearch] = useState("");
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold tracking-wider text-muted uppercase">
        Schüler · {count}
      </h3>
      <div className="flex flex-wrap gap-2">
        {classes.length > 0 && (
          <Autocomplete
            size="small"
            className="w-72"
            options={classes}
            value={null}
            inputValue={search}
            onInputChange={(_, value, reason) => {
              if (reason != "reset") setSearch(value);
            }}
            getOptionLabel={getCopyLabel}
            filterOptions={(options, { inputValue }) =>
              filterCopyClasses(options, inputValue, target, levels)
            }
            noOptionsText="Keine Klasse gefunden"
            onChange={(_, selected) => {
              if (!selected) return;
              setSearch("");
              onCopy(selected);
            }}
            renderInput={(params) => (
              <TextField {...params} label="Aus Klasse übernehmen" />
            )}
          />
        )}
        <Button component="label" variant="outlined" disabled={importing}>
          {importing ? "Wird gelesen …" : "WebUntis-PDF"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(event) => onImport(event.target)}
          />
        </Button>
        <Button variant="outlined" onClick={onPaste}>
          Liste einfügen
        </Button>
        <Button variant="outlined" onClick={onAdd}>
          Schüler hinzufügen
        </Button>
      </div>
    </div>
  );
}
