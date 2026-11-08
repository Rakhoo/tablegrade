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

/**
 * A switch of the speed dial for a display option.
 * @param option The option's value and setter, e.g. from `useDisplayOption`.
 */
export const displaySwitch = (
  entry: {
    key: string;
    label: string;
    icon: ReactNode;
    offIcon: ReactNode;
    help: string;
  },
  [checked, setChecked]: readonly [boolean, (value: boolean) => void],
): SpeedDialEntry => ({
  ...entry,
  checked,
  onClick: () => setChecked(!checked),
});
