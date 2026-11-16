import type { SpeedDialEntry } from "../../components/SpeedDial";
import {
  classPageEntries,
  displaySwitch,
  visibilitySwitch,
  type SwitchOption,
} from "../../components/speedDialEntries";
import {
  DutyIcon,
  DutyOffIcon,
  ImageIcon,
  ImageOffIcon,
  TagIcon,
  TagOffIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "../../components/icons";

type ClassroomDialOptions = {
  classId: number;
  date: string;
  hasPhotos: boolean;
  hasDuties: boolean;
  hasTraits: boolean;
  /** Whether the seats can be zoomed to; never while arranging. */
  canZoom: boolean;
  /** Whether the lesson has entries to clear. */
  canClear: boolean;
  onClear: () => void;
  options: Record<"zoom" | "photos" | "duties" | "traits", SwitchOption>;
};

/** The seating plan's speed dial: sub pages, clearing the lesson and display switches. */
export function classroomDialEntries({
  classId,
  date,
  hasPhotos,
  hasDuties,
  hasTraits,
  canZoom,
  canClear,
  onClear,
  options,
}: ClassroomDialOptions) {
  const entries: SpeedDialEntry[] = [
    ...classPageEntries(classId, date, hasPhotos),
    {
      key: "clear",
      label: "Stunde zurücksetzen",
      icon: <TrashIcon />,
      danger: true,
      help: "Löscht ausgewählte Einträge dieser Stunde: Ermahnungen, Bewertungen oder Kommentare.",
      disabled: !canClear,
      onClick: onClear,
    },
  ];
  if (canZoom) {
    entries.push(
      displaySwitch(
        {
          key: "zoom",
          on: { label: "Zoom auf die Plätze", action: "ganzer Raum" },
          off: { label: "Ganzer Raum", action: "Zoom" },
          icon: <ZoomInIcon />,
          offIcon: <ZoomOutIcon />,
          help: "Zeigt nur den Teil des Raums, in dem Schüler sitzen, so groß wie möglich.",
        },
        options.zoom,
      ),
    );
  }
  if (hasPhotos) {
    entries.push(
      visibilitySwitch(
        {
          key: "photos",
          noun: "Bilder",
          icon: <ImageIcon />,
          offIcon: <ImageOffIcon />,
          help: "Zeigt die Fotos der Schüler im Sitzplan.",
        },
        options.photos,
      ),
    );
  }
  if (hasDuties) {
    entries.push(
      visibilitySwitch(
        {
          key: "duties",
          noun: "Dienste",
          icon: <DutyIcon />,
          offIcon: <DutyOffIcon />,
          help: "Zeigt die Dienste als farbige Symbole oben links an den Plätzen.",
        },
        options.duties,
      ),
    );
  }
  if (hasTraits) {
    entries.push(
      visibilitySwitch(
        {
          key: "traits",
          noun: "Eigenschaften",
          icon: <TagIcon />,
          offIcon: <TagOffIcon />,
          help: "Zeigt die Eigenschaften als farbige Punkte um die Fotos.",
        },
        options.traits,
      ),
    );
  }
  return entries;
}
