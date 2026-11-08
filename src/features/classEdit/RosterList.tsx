import { Avatar, ButtonBase, IconButton } from "@mui/material";
import { EyeIcon, EyeOffIcon, TrashIcon } from "../../components/icons";
import type { RosterEntry, Trait } from "../../db";
import { compareStudents, formatStudentName } from "../../lib/formatters";

/** Roster row with a stable React key, also for students not saved yet. */
export type RosterRow = RosterEntry & { key: string };

type RosterListProps = {
  rows: RosterRow[];
  traits: Trait[];
  onEdit: (row: RosterRow) => void;
  onToggleHidden: (row: RosterRow) => void;
  onRemove: (row: RosterRow) => void;
};

/** The students of a class, alphabetically, with their nickname and traits. */
export function RosterList({
  rows: roster,
  traits,
  onEdit,
  onToggleHidden,
  onRemove,
}: RosterListProps) {
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
                  ...traits
                    .filter((trait) => row.traitIds.includes(trait.id))
                    .map((trait) => trait.name),
                ]
                  .filter(Boolean)
                  .join(" · ") || "\u00a0"}
              </span>
            </span>
          </ButtonBase>
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
    </div>
  );
}
