import {
  Avatar,
  ButtonBase,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
} from "@mui/material";
import { useState } from "react";
import { DutyBadge } from "../../components/dutySymbols";
import {
  DutyIcon,
  EyeIcon,
  EyeOffIcon,
  TrashIcon,
} from "../../components/icons";
import type { Duty, RosterEntry, Trait } from "../../db";
import { compareStudents, formatStudentName } from "../../lib/formatters";

/** Roster row with a stable React key, also for students not saved yet. */
export type RosterRow = RosterEntry & { key: string };

type RosterListProps = {
  rows: RosterRow[];
  traits: Trait[];
  /** Duties to choose from; without any, the duty button is left out. */
  duties: Duty[];
  onEdit: (row: RosterRow) => void;
  onToggleHidden: (row: RosterRow) => void;
  onDutyChange: (row: RosterRow, dutyId: number | null) => void;
  onRemove: (row: RosterRow) => void;
};

/** The students of a class, alphabetically, with their nickname, traits and duty. */
export function RosterList({
  rows: roster,
  traits,
  duties,
  onEdit,
  onToggleHidden,
  onDutyChange,
  onRemove,
}: RosterListProps) {
  const [dutyMenu, setDutyMenu] = useState<{
    row: RosterRow;
    anchor: HTMLElement;
  } | null>(null);
  const dutyOf = (row: RosterRow) =>
    duties.find((duty) => duty.id == row.dutyId);

  /** Gives the student of the open menu a duty, or none. */
  const chooseDuty = (dutyId: number | null) => {
    if (dutyMenu) onDutyChange(dutyMenu.row, dutyId);
    setDutyMenu(null);
  };

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 landscape:grid-cols-2">
      {[...roster].sort(compareStudents).map((row) => (
        <div key={row.key} className="flex items-center gap-1">
          <ButtonBase
            onClick={() => onEdit(row)}
            className={
              "flex min-w-0 flex-1 items-center justify-start gap-3 rounded-2xl border border-line p-2 text-left " +
              (row.hidden ? "opacity-50" : "")
            }
          >
            <Avatar
              src={row.image ?? undefined}
              alt=""
              sx={{ width: 40, height: 40 }}
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {formatStudentName(row)}
              </span>
              <span className="block truncate text-xs text-muted">
                {[
                  row.hidden && "Ausgeblendet",
                  row.nickname,
                  dutyOf(row)?.name,
                  ...traits
                    .filter((trait) => row.traitIds.includes(trait.id))
                    .map((trait) => trait.name),
                ]
                  .filter(Boolean)
                  .join(" · ") || "\u00a0"}
              </span>
            </span>
          </ButtonBase>
          {duties.length > 0 && (
            <IconButton
              aria-label={`Dienst von ${formatStudentName(row)}`}
              data-help="Gibt dem Schüler einen Dienst in dieser Klasse."
              data-help-repeat
              onClick={(event) =>
                setDutyMenu({ row, anchor: event.currentTarget })
              }
            >
              {dutyOf(row) ? (
                <DutyBadge duty={dutyOf(row)!} size={24} />
              ) : (
                <DutyIcon size={18} />
              )}
            </IconButton>
          )}
          <IconButton
            aria-label={`${formatStudentName(row)} ${row.hidden ? "einblenden" : "ausblenden"}`}
            onClick={() => onToggleHidden(row)}
          >
            {row.hidden ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </IconButton>
          <IconButton
            color="error"
            aria-label={`${formatStudentName(row)} entfernen`}
            onClick={() => onRemove(row)}
          >
            <TrashIcon size={18} />
          </IconButton>
        </div>
      ))}
      <Menu
        anchorEl={dutyMenu?.anchor}
        open={!!dutyMenu}
        onClose={() => setDutyMenu(null)}
      >
        <MenuItem
          selected={dutyMenu?.row.dutyId == null}
          onClick={() => chooseDuty(null)}
        >
          <ListItemIcon>
            <DutyIcon size={20} />
          </ListItemIcon>
          Kein Dienst
        </MenuItem>
        {duties.map((duty) => (
          <MenuItem
            key={duty.id}
            selected={dutyMenu?.row.dutyId == duty.id}
            onClick={() => chooseDuty(duty.id)}
          >
            <ListItemIcon>
              <DutyBadge duty={duty} size={24} />
            </ListItemIcon>
            {duty.name}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
