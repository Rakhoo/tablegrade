/** What a tap on a cell does: nothing (viewing), apply the grading tool or edit the comment. */
export type OverviewMode = "view" | "grade" | "comment";

/** The modes with their names and explanations. */
export const MODES: { value: OverviewMode; label: string; help: string }[] = [
  {
    value: "view",
    label: "Betrachten",
    help: "Modus Betrachten: die Tabelle nur ansehen, ein Tipp in eine Zelle ändert nichts.",
  },
  {
    value: "grade",
    label: "Bewerten",
    help: "Modus Bewerten: Werkzeug wählen und Zellen antippen.",
  },
  {
    value: "comment",
    label: "Kommentieren",
    help: "Modus Kommentieren: Kommentare der Stunden lesen und schreiben.",
  },
];

/** What a tap on a cell does per mode, explained by the help at the best visible cell. */
export const CELL_HELP: Record<OverviewMode, string> = {
  view: "Zum Ändern oben „Bewerten“ oder „Kommentieren“ wählen.",
  grade:
    "Antippen wendet das gewählte Werkzeug an; Teil- und Halbjahresnoten lassen sich mit Noten korrigieren.",
  comment:
    "Antippen bearbeitet oder beginnt einen Kommentar; Sprechblasen zeigen seinen Anfang.",
};
