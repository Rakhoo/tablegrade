import type { ClassroomMode } from "../../lib/settings";

/** The modes of the seating plan with their explanations. */
export const MODES: {
  mode: ClassroomMode;
  label: string;
  help: string;
  /** What a tap on the seating plan does in this mode. */
  gridHelp: string;
  /** Hint below the mode choice; grading shows its tools and warning its levels instead. */
  hint?: string;
}[] = [
  {
    mode: "warn",
    label: "Ermahnen",
    help: "Modus Ermahnen: Antippen eines Schülers ermahnt ihn.",
    gridHelp:
      "Antippen ermahnt, ein zweites Mal verhängt eine Maßnahme, ein drittes nimmt beides zurück.",
  },
  {
    mode: "grade",
    label: "Bewerten",
    help: "Modus Bewerten: Symbole oder Noten für diese Stunde vergeben.",
    gridHelp:
      "Antippen vergibt das gewählte Werkzeug; gestrichelte Symbole sind Vorschläge.",
  },
  {
    mode: "comment",
    label: "Kommentieren",
    help: "Modus Kommentieren: Kommentare zu dieser Stunde lesen und schreiben.",
    gridHelp:
      "Antippen bearbeitet oder beginnt einen Kommentar; Sprechblasen zeigen seinen Anfang.",
    hint: "Schüler antippen, um den Kommentar zu bearbeiten oder einen neuen zu schreiben",
  },
  {
    mode: "arrange",
    label: "Anordnen",
    help: "Modus Anordnen: die Sitzordnung ändern.",
    gridHelp:
      "Schüler auf einen Platz ziehen; auf einem anderen Schüler tauschen beide.",
    hint: "Schüler zum Verschieben auf einen Platz ziehen",
  },
];
