import { exportDatabase } from "../db";
import { toIsoDate } from "../lib/dates";

/** First 16 bytes of every SQLite 3 database file. */
const SQLITE_HEADER = "SQLite format 3\0";

/** Whether the file starts with the SQLite file signature. */
export async function isSqliteFile(file: File) {
  const header = await file.slice(0, SQLITE_HEADER.length).arrayBuffer();
  return new TextDecoder().decode(header) == SQLITE_HEADER;
}

/**
 * Exports the database as `tablegrade-YYYY-MM-DD.sqlite3`. Uses the share sheet where
 * available (iPad: "In Dateien sichern"), otherwise a regular download.
 */
export async function saveBackup() {
  const database = await exportDatabase();
  const file = new File(
    [database],
    `tablegrade-${toIsoDate(new Date())}.sqlite3`,
    {
      type: "application/x-sqlite3",
    },
  );

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // Closing the share sheet is no error; anything else falls back to the download
      if ((error as Error).name == "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}
