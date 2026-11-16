import { useState } from "react";
import type { RosterEntry } from "../../db";
import {
  fillNicknames,
  getImportNickname,
  mergeStudents,
} from "../../lib/studentRoster";
import type { RosterRow } from "./RosterList";

/** Outcome of an import, shown above the roster. */
type ImportResult = { text: string; error?: boolean };

/**
 * Imports a WebUntis PDF into the roster of the class editor.
 * @returns The import state, its result message and the handler of the file input.
 */
export function useRosterPdfImport(
  roster: RosterRow[],
  createRow: (entry: RosterEntry) => RosterRow,
  setRoster: (change: (prev: RosterRow[]) => RosterRow[]) => void,
) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  /** Reads a WebUntis PDF and matches it with the roster by first and last name. */
  const importPdf = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      // Read first: iOS may discard the picked file once the input is reset
      const data = await file.arrayBuffer();
      // Loaded on demand, as the PDF library is large
      const { readRosterPdf } = await import("../../services/rosterPdf");
      const incoming = await readRosterPdf(data);
      if (!incoming?.length) {
        setImportResult({
          error: true,
          text: "In dieser Datei wurde keine Schülerliste gefunden.",
        });
        return;
      }
      const result = mergeStudents(
        roster,
        incoming.map((student) => ({
          ...student,
          nickname: getImportNickname(student.firstName),
        })),
        createRow,
      );
      setRoster(() => fillNicknames(result.rows));
      setImportResult({
        text:
          `${result.added} neu, ${result.matched} abgeglichen` +
          (result.missing
            ? `, ${result.missing} nicht in der Datei (bleiben in der Liste)`
            : ""),
      });
    } catch (error) {
      console.error(error);
      // The technical details help with diagnosing, as the iPad has no visible console
      const { name, message } = error as Error;
      setImportResult({
        error: true,
        text: `Die Datei konnte nicht gelesen werden (${name}: ${message}).`,
      });
    } finally {
      // Allow choosing the same file again
      input.value = "";
      setImporting(false);
    }
  };

  return { importing, importResult, setImportResult, importPdf };
}
