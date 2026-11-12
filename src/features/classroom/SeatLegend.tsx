import { Popover } from "@mui/material";
import { DutyBadge } from "../../components/dutySymbols";
import type { Duty, SeatedStudent, Trait } from "../../db";

type SeatLegendProps = {
  /** The button it opens from; `null` while closed. */
  anchor: HTMLElement | null;
  onClose: () => void;
  /** The traits shown on the seats; empty while they are hidden. */
  traits: Trait[];
  /** The duties shown on the seats; empty while they are hidden. */
  duties: Duty[];
  students: SeatedStudent[];
};

/** Space kept between the legend and the right edge of the screen, as MUI's popover does. */
const SCREEN_MARGIN = 16;
/** Gap between the button and the legend. */
const GAP = 8;

/**
 * Legend of the duty symbols and trait dots in this class with their count. It opens to the
 * right of its button, bottom aligned with it, and wraps upwards only when the row is too narrow.
 */
export function SeatLegend({
  anchor,
  onClose,
  traits,
  duties,
  students,
}: SeatLegendProps) {
  const dutyCounts = duties
    .map((duty) => ({
      duty,
      count: students.filter((student) => student.dutyId == duty.id).length,
    }))
    .filter(({ count }) => count > 0);
  const counts = traits
    .map((trait) => ({
      trait,
      count: students.filter((student) => student.traitIds.includes(trait.id))
        .length,
    }))
    .filter(({ count }) => count > 0);

  const maxWidth = anchor
    ? window.innerWidth -
      anchor.getBoundingClientRect().right -
      GAP -
      SCREEN_MARGIN
    : undefined;

  return (
    <Popover
      open={!!anchor}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      marginThreshold={SCREEN_MARGIN}
      slotProps={{
        paper: { className: "ml-2 bg-brand-100/75", style: { maxWidth } },
      }}
    >
      <div className="px-4 py-2">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {dutyCounts.map(({ duty, count }) => (
            <li
              key={`duty-${duty.id}`}
              className="flex h-5 items-center gap-2 whitespace-nowrap"
            >
              <DutyBadge duty={duty} size={20} />
              <span className="font-medium">{duty.name}</span>
              <span className="text-sm text-muted">{count}</span>
            </li>
          ))}
          {counts.map(({ trait, count }) => (
            <li
              key={trait.id}
              className="flex h-5 items-center gap-2 whitespace-nowrap"
            >
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ background: trait.color }}
              />
              <span className="font-medium">{trait.name}</span>
              <span className="text-sm text-muted">{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  );
}
