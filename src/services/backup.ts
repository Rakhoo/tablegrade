import { exportDatabase, saveSettings } from "../db";
import { toIsoDate } from "../lib/dates";

/** First 16 bytes of every SQLite 3 database file. */
const SQLITE_HEADER = "SQLite format 3\0";

/** Whether the file starts with the SQLite file signature. */
export async function isSqliteFile(file: File) {
  const header = await file.slice(0, SQLITE_HEADER.length).arrayBuffer();
  return new TextDecoder().decode(header) == SQLITE_HEADER;
}

/** Size and first bytes of a file for error messages, without any of its contents' meaning. */
export async function describeFile(file: Blob) {
  const header = await file.slice(0, SQLITE_HEADER.length).arrayBuffer();
  const bytes = [...new Uint8Array(header)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
  return `${file.size} Bytes, Anfang: ${bytes || "leer"}`;
}

/** Downloads a file directly, so it cannot be sent to someone by accident. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari reads the file after the click returned, so the URL has to stay valid for a while
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Exports the database as `tablegrade-YYYY-MM-DD.sqlite3` and notes the date of the backup. */
export async function saveBackup() {
  const today = toIsoDate(new Date());
  const database = await exportDatabase();
  // Better a visible failure now than a backup that turns out to be broken when it is needed
  if (!(await isSqliteFile(database))) {
    throw new Error(`Ungültige Daten (${await describeFile(database)})`);
  }
  downloadFile(
    new File([database], `tablegrade-${today}.sqlite3`, {
      type: "application/x-sqlite3",
    }),
  );
  await saveSettings({ lastBackup: today });
}
