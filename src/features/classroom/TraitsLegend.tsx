import { Popover } from "@mui/material";
import type { SeatedStudent, Trait } from "../../db";

type TraitsLegendProps = {
  /** The button it opens from; `null` while closed. */
  anchor: HTMLElement | null;
  onClose: () => void;
  traits: Trait[];
  students: SeatedStudent[];
};

/** Legend of the trait dots in this class with their count. */
export function TraitsLegend({
  anchor,
  onClose,
  traits,
  students,
}: TraitsLegendProps) {
  const counts = traits
    .map((trait) => ({
      trait,
      count: students.filter((student) => student.traitIds.includes(trait.id))
        .length,
    }))
    .filter(({ count }) => count > 0);

  return (
    <Popover
      open={!!anchor}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
      transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{ paper: { className: "-mt-2 bg-brand-100/75" } }}
    >
      <div className="flex min-w-56 flex-col gap-3 p-4">
        <ul className="flex flex-col gap-2">
          {counts.map(({ trait, count }) => (
            <li key={trait.id} className="flex items-center gap-2.5">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ background: trait.color }}
              />
              <span className="flex-1 font-medium">{trait.name}</span>
              <span className="text-sm text-muted">{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  );
}
