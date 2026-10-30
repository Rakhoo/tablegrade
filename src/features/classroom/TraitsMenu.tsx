import { Button, FormControlLabel, Popover, Switch } from "@mui/material";
import { useState } from "react";
import { InfoIcon } from "../../components/icons";
import type { SeatedStudent, Trait } from "../../db";
import { getTraitColor } from "../../lib/traits";

type TraitsMenuProps = {
  traits: Trait[];
  students: SeatedStudent[];
  /** Whether the trait dots are shown on the seating plan. */
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

/** Button with the legend of the trait dots, their count and a switch to hide them. */
export function TraitsMenu({
  traits,
  students,
  visible,
  onVisibleChange,
}: TraitsMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        startIcon={<InfoIcon size={18} />}
        onClick={(event) => setAnchor(event.currentTarget)}
        className="bg-surface shadow-tile"
      >
        Eigenschaften
      </Button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { className: "-mt-2" } }}
      >
        <div className="flex min-w-56 flex-col gap-3 p-4">
          <ul className="flex flex-col gap-2">
            {traits.map((trait) => {
              const count = students.filter((student) =>
                student.traitIds.includes(trait.id),
              ).length;
              return (
                <li key={trait.id} className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: getTraitColor(trait.name) }}
                  />
                  <span className="flex-1 font-medium">{trait.name}</span>
                  <span className="text-sm text-muted">{count}</span>
                </li>
              );
            })}
          </ul>
          <FormControlLabel
            className="m-0 justify-between border-t border-line pt-2"
            labelPlacement="start"
            label="Im Sitzplan anzeigen"
            control={
              <Switch
                checked={visible}
                onChange={(event) => onVisibleChange(event.target.checked)}
              />
            }
          />
        </div>
      </Popover>
    </>
  );
}
