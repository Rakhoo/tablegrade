import { drizzle } from "drizzle-orm/sqlite-proxy";
import { SQLocalDrizzle } from "sqlocal/drizzle";
import { MIGRATIONS } from "./migrations";

/** Applies all migrations newer than the database's `user_version`, each in its own transaction. */
async function migrate() {
  const [{ user_version: version }] = await client.sql<{
    user_version: number;
  }>("PRAGMA user_version");
  for (let i = version; i < MIGRATIONS.length; i++) {
    await client.transaction(async (tx) => {
      for (const statement of MIGRATIONS[i]) await tx.sql(statement);
      await tx.sql(`PRAGMA user_version = ${i + 1}`);
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

/** Returns the whole SQLite database as a file, e.g. for a backup. */
export const exportDatabase = () => client.getDatabaseFile();

/**
 * Replaces the database with an exported file and brings it up to the current schema.
 * The page should be reloaded afterwards, so no stale data is shown.
 */
export async function importDatabase(file: File) {
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
