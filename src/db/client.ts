import { drizzle } from "drizzle-orm/sqlite-proxy";
import { SQLocalDrizzle } from "sqlocal/drizzle";
import { BASELINE, BASELINE_VERSION, MIGRATIONS } from "./migrations";

/**
 * Brings the database to the current schema: an empty one gets the first release's schema,
 * then every newer migration runs in its own transaction. Fails for development versions.
 */
async function migrate() {
  const [{ user_version: version }] = await client.sql<{
    user_version: number;
  }>("PRAGMA user_version");
  if (version > 0 && version < BASELINE_VERSION)
    throw new Error("Die Datenbank stammt aus einer Vorabversion der App.");
  const steps = [
    ...(version == 0
      ? [{ statements: BASELINE, version: BASELINE_VERSION }]
      : []),
    ...MIGRATIONS.map((statements, index) => ({
      statements,
      version: BASELINE_VERSION + index + 1,
    })).filter((step) => step.version > version),
  ];
  for (const { statements, version: next } of steps) {
    await client.transaction(async (tx) => {
      for (const statement of statements) await tx.sql(statement);
      await tx.sql(`PRAGMA user_version = ${next}`);
    });
  }
}

let importing = false;
let resolveReady: () => void;
const ready = new Promise<void>((resolve) => (resolveReady = resolve));

/** The SQLocal client, also used for transactions (`client.transaction(tx => tx.query(…))`). */
export const client = new SQLocalDrizzle({
  databasePath: "tablegrade.sqlite3",
  onInit: (sql) => [sql`PRAGMA foreign_keys = ON`],
  onConnect: () => {
    // During an import the migrations run in `importDatabase` while the file is still locked
    if (!importing) migrate().then(() => resolveReady());
  },
});

export const db = drizzle(client.driver, client.batchDriver);

/**
 * Whether the database is stored on the device. SQLocal silently falls back to an in-memory
 * database if that fails for any reason, which would lose everything on closing the app.
 */
export async function isDatabasePersistent() {
  const { storageType } = await client.getDatabaseInfo();
  return storageType == "opfs";
}

/** Returns the whole SQLite database as a file, e.g. for a backup. */
export const exportDatabase = () => client.getDatabaseFile();

/** A backup that cannot be imported, with a message for the user. */
export class BackupError extends Error {}

/** Checks a backup before it replaces anything: an SQLite file of a supported schema version. */
async function checkBackup(file: File) {
  // The header holds the format name and, at byte 60, the `user_version`
  const header = new DataView(await file.slice(0, 64).arrayBuffer());
  const name = new TextDecoder().decode(header.buffer.slice(0, 15));
  if (header.byteLength < 64 || name != "SQLite format 3")
    throw new BackupError("Die Datei ist keine Sicherung von tablegrade.");
  const version = header.getUint32(60);
  if (version < BASELINE_VERSION)
    throw new BackupError(
      "Die Sicherung stammt aus einer Vorabversion der App.",
    );
  if (version > BASELINE_VERSION + MIGRATIONS.length)
    throw new BackupError(
      "Die Sicherung stammt aus einer neueren Version der App.",
    );
}

/**
 * Replaces the database with an exported file and brings it up to the current schema.
 * The page should be reloaded afterwards, so no stale data is shown.
 * @throws {BackupError} If the file is no backup of a supported version; nothing is replaced.
 */
export async function importDatabase(file: File) {
  await checkBackup(file);
  importing = true;
  try {
    await client.overwriteDatabaseFile(file, migrate);
  } finally {
    importing = false;
  }
}

/** Resolves once the database is connected and fully migrated. */
export function waitForDatabase() {
  return ready;
}
