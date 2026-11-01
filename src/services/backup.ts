import { exportDatabase, saveSettings } from "../db";
import { toIsoDate } from "../lib/dates";
import { isMobileDevice } from "./pwa";

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

/** Downloads a file directly, without any dialog. */
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

/**
 * Hands a file to the share sheet on phones and tablets, where it is the convenient way to
 * "Dateien" and the like, and downloads it elsewhere or if sharing is not possible.
 * @returns `false` if the user closed the share sheet without saving.
 */
async function saveFile(file: File) {
  if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if ((error as Error).name == "AbortError") return false;
    }
  }
  downloadFile(file);
  return true;
}

/**
 * Exports the database as `tablegrade-YYYY-MM-DD.sqlite3` and notes the date of the backup.
 * @returns `false` if the backup was cancelled.
 */
export async function saveBackup() {
  const today = toIsoDate(new Date());
  const database = await exportDatabase();
  // Better a visible failure now than a backup that turns out to be broken when it is needed
  if (!(await isSqliteFile(database))) {
    throw new Error(`Ungültige Daten (${await describeFile(database)})`);
  }
  const saved = await saveFile(
    new File([database], `tablegrade-${today}.sqlite3`, {
      type: "application/x-sqlite3",
    }),
  );
  if (saved) await saveSettings({ lastBackup: today });
  return saved;
}
