import { DatabaseSync } from "node:sqlite";
import { BASELINE, BASELINE_VERSION, MIGRATIONS } from "../db/migrations";

/** The newest schema version the app knows. */
export const LATEST_VERSION = BASELINE_VERSION + MIGRATIONS.length;

/** Reads `PRAGMA user_version` of a test database. */
export function userVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  return row.user_version;
}

/**
 * Brings a test database to `target` like `src/db/client.ts` does in the app: foreign keys
 * on, the baseline for an empty database, then each newer migration in its own transaction.
 */
export function migrateTo(db: DatabaseSync, target = LATEST_VERSION) {
  const version = userVersion(db);
  const steps = [
    ...(version == 0
      ? [{ statements: BASELINE, version: BASELINE_VERSION }]
      : []),
    ...MIGRATIONS.map((statements, index) => ({
      statements,
      version: BASELINE_VERSION + index + 1,
    })).filter((step) => step.version > version),
  ].filter((step) => step.version <= target);
  for (const { statements, version: next } of steps) {
    db.exec("BEGIN");
    try {
      for (const statement of statements) db.exec(statement);
      db.exec(`PRAGMA user_version = ${next}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

/**
 * Opens an in-memory SQLite database with foreign keys on, migrated to `target`
 * (default: the newest version). Tests use it to check migrations and triggers without a browser.
 */
export function openTestDb(target = LATEST_VERSION): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrateTo(db, target);
  return db;
}
