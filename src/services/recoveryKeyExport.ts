import { format } from "date-fns";
import { saveFile } from "./backup";

/** Title on the printout and in the file. */
const TITLE = "Notenfeder – Wiederherstellungsschlüssel";
/** Explanation next to the key, so a found sheet or file still makes sense. */
const NOTE =
  "Mit diesem Schlüssel lassen sich die Daten von Notenfeder auf einem neuen Gerät entsperren. " +
  "Ohne ihn sind die Daten weg, wenn alle Geräte verloren gehen. Niemand kann ihn zurücksetzen. " +
  "Sicher aufbewahren und nicht weitergeben.";

/** Date line, so an old key can be told apart from a newer one. */
function createdLine() {
  return `Erstellt am ${format(new Date(), "dd.MM.yyyy")}`;
}

/** Copies the recovery key to the clipboard. */
export function copyRecoveryKey(key: string) {
  return navigator.clipboard.writeText(key);
}

/**
 * Saves the recovery key as a text file (share sheet on tablets, download elsewhere).
 * @returns `false` if the user closed the share sheet without saving.
 */
export function saveRecoveryKey(key: string) {
  const text = [TITLE, "", key, "", createdLine(), "", NOTE, ""].join("\n");
  return saveFile(
    new File([text], "Notenfeder-Wiederherstellungsschluessel.txt", {
      type: "text/plain",
    }),
  );
}

/**
 * Prints a page with only the recovery key. Uses a hidden frame, so the app page itself is not
 * printed and stays as it is.
 */
export function printRecoveryKey(key: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.append(frame);
  // An attached frame without `src` always has its own empty document and window
  const page = frame.contentDocument!;
  const heading = page.createElement("h1");
  heading.textContent = TITLE;
  const keyLine = page.createElement("p");
  keyLine.textContent = key;
  keyLine.style.font = "bold 20pt monospace";
  const date = page.createElement("p");
  date.textContent = createdLine();
  const note = page.createElement("p");
  note.textContent = NOTE;
  page.body.style.fontFamily = "sans-serif";
  page.body.append(heading, keyLine, date, note);
  frame.contentWindow!.print();
  // print() blocks until the dialog closes in most browsers; the delay covers the others
  setTimeout(() => frame.remove(), 60_000);
}
