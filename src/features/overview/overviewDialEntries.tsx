import {
  classPageEntries,
  displaySwitch,
  visibilitySwitch,
  type SwitchOption,
} from "../../components/speedDialEntries";
import {
  BadgeIcon,
  ImageIcon,
  ImageOffIcon,
  SmileIcon,
  SortIcon,
  SortOffIcon,
  TagIcon,
  TagOffIcon,
} from "../../components/icons";

type OverviewDialOptions = {
  classId: number;
  lessonDate: string | null;
  hasPhotos: boolean;
  hasTraits: boolean;
  options: Record<
    "photos" | "traits" | "nicknames" | "lastNameSort",
    SwitchOption
  >;
};

/** The overview's speed dial: the class's sub pages and switches for what the table shows. */
export function overviewDialEntries({
  classId,
  lessonDate,
  hasPhotos,
  hasTraits,
  options,
}: OverviewDialOptions) {
  const entries = classPageEntries(classId, lessonDate, hasPhotos);
  if (hasPhotos) {
    entries.push(
      visibilitySwitch(
        {
          key: "photos",
          noun: "Bilder",
          icon: <ImageIcon />,
          offIcon: <ImageOffIcon />,
          help: "Zeigt die Fotos vor den Namen.",
        },
        options.photos,
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
          help: "Zeigt die Eigenschaften ausgeschrieben unter den Namen.",
        },
        options.traits,
      ),
    );
  }
  entries.push(
    displaySwitch(
      {
        key: "nicknames",
        on: { label: "Spitznamen", action: "volle Namen" },
        off: { label: "Volle Namen", action: "Spitznamen" },
        icon: <SmileIcon />,
        offIcon: <BadgeIcon />,
        help: "Zeigt Spitznamen statt der vollen Namen; solange nicht nach Nachname sortiert wird, folgt die Reihenfolge den angezeigten Namen.",
      },
      options.nicknames,
    ),
    // Sorting comes after the display options, so they stay together
    displaySwitch(
      {
        key: "lastNameSort",
        on: { label: "Nach Nachname sortiert", action: "nach Anzeigename" },
        off: { label: "Nach Anzeigename sortiert", action: "nach Nachname" },
        icon: <SortIcon />,
        offIcon: <SortOffIcon />,
        help: "Sortiert die Schüler nach Nachnamen, auch wenn sie nicht angezeigt werden; sonst nach den angezeigten Namen.",
      },
      options.lastNameSort,
    ),
  );
  return entries;
}
