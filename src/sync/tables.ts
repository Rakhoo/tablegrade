/**
 * Synced tables of the current schema (docs/protocol.md 4) and SQL helpers by primary key. Unlike
 * the frozen list in the migrations, this list follows the newest schema.
 */
import type { KeyValue } from "../crypto/records";
import { DEVICE_SETTING_KEYS } from "../lib/settings";
import type { SqlRunner } from "./syncDb";

/** Primary key columns of every synced table, in schema order. */
export const SYNCED_TABLES: Readonly<Record<string, readonly string[]>> = {
  Classes: ["id"],
  Students: ["id"],
  Classes2Students: ["classId", "studentId"],
  Grades: ["id"],
  CancelledDays: ["date"],
  CancelledLessons: ["classId", "date"],
  LessonTypes: ["classId", "date", "type"],
  Traits: ["id"],
  Students2Traits: ["studentId", "traitId"],
  Settings: ["key"],
  SchoolYears: ["year"],
  Reports: ["classId", "date", "kind"],
  ReportGrades: ["classId", "date", "kind", "studentId"],
  Duties: ["id"],
};

/** Unique indexes besides the primary key; two devices can create rows that clash there. */
export const UNIQUE_KEYS: Readonly<Record<string, readonly string[]>> = {
  Grades: ["classId", "studentId", "date"],
};

/** Plain SQL identifier; column names from records are checked before they reach SQL. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Whether `name` may be used as a column name in SQL. */
export function isIdentifier(name: string): boolean {
  return IDENTIFIER.test(name);
}

/** Whether a row of `table` with key `pk` is synced at all (device settings are not). */
export function isSyncedKey(table: string, pk: KeyValue[]): boolean {
  if (!(table in SYNCED_TABLES)) return false;
  return !(
    table == "Settings" &&
    (DEVICE_SETTING_KEYS as readonly unknown[]).includes(pk[0])
  );
}

/** `WHERE` condition on the given columns, for use with their values as parameters. */
export function whereColumns(columns: readonly string[]): string {
  return columns.map((column) => `${column} = ?`).join(" AND ");
}

/** Reads the row of `table` with key `pk`; `null` if it does not exist. */
export async function readRow(
  db: SqlRunner,
  table: string,
  pk: KeyValue[],
): Promise<Record<string, unknown> | null> {
  const [row] = await db.all(
    `SELECT * FROM ${table} WHERE ${whereColumns(SYNCED_TABLES[table])}`,
    pk,
  );
  return row ?? null;
}

/** Adds a key to the outbox by hand, as the triggers would; used while they are quiet. */
export function recordChange(
  db: SqlRunner,
  table: string,
  pk: KeyValue[],
): Promise<void> {
  return db.run("INSERT INTO _outbox (tbl, pk, changedAt) VALUES (?, ?, ?)", [
    table,
    JSON.stringify(pk),
    Date.now(),
  ]);
}

/** Empties the outbox and the engine's tables; used when sync starts from scratch. */
export async function clearSyncTables(db: SqlRunner): Promise<void> {
  for (const table of ["_outbox", "_sync_pending", "_sync_blobs"])
    await db.run(`DELETE FROM ${table}`);
}
