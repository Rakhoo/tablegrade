import type { ReactNode } from "react";
import { paths } from "../lib/paths";
import { CardsIcon, PencilIcon } from "./icons";
import type { SpeedDialEntry } from "./SpeedDial";

/** The speed dial entries of the seating plan and overview leading to a class's sub pages. */
export const classPageEntries = (
  classId: number,
  date: string | null,
  hasPhotos: boolean,
): SpeedDialEntry[] => [
  {
    key: "edit",
    label: "Bearbeiten",
    icon: <PencilIcon />,
    help: "Klasse bearbeiten: Fach, Stunden und Schülerliste.",
    to: paths.edit(classId, date),
  },
  {
    key: "names",
    label: "Namen lernen",
    icon: <CardsIcon />,
    help: "Karteikarten mit den Fotos, um die Namen der Klasse zu lernen.",
    disabled: !hasPhotos,
    to: paths.names(classId, date),
  },
];

/** How a switch reads in one state: what is shown now, and what a tap changes it to. */
type SwitchState = { label: string; action: string };

/**
 * A switch of the speed dial for a display option. Its label says what is shown now, the line
 * below what a tap does, e.g. "Bilder sichtbar" and "Tippen: ausblenden".
 * @param option The option's value and setter, e.g. from `useDisplayOption`.
 */
export const displaySwitch = (
  {
    on,
    off,
    ...entry
  }: {
    key: string;
    on: SwitchState;
    off: SwitchState;
    icon: ReactNode;
    offIcon: ReactNode;
    help: string;
  },
  [checked, setChecked]: readonly [boolean, (value: boolean) => void],
): SpeedDialEntry => ({
  ...entry,
  label: (checked ? on : off).label,
  detail: `Tippen: ${(checked ? on : off).action}`,
  checked,
  onClick: () => setChecked(!checked),
});
