import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqlRunner, SqlValue, SyncDb } from "../sync/syncDb";

/** Runner over a `node:sqlite` database. */
function runner(db: DatabaseSync): SqlRunner {
  return {
    all: async <T>(sql: string, params: SqlValue[] = []) =>
      db.prepare(sql).all(...(params as SQLInputValue[])) as T[],
    run: async (sql, params = []) => {
      db.prepare(sql).run(...(params as SQLInputValue[]));
    },
  };
}

/** Wraps a test database (see `openTestDb`) as the sync engine's `SyncDb`. */
export function asSyncDb(db: DatabaseSync): SyncDb {
  return {
    ...runner(db),
    transaction: async (action) => {
      db.exec("BEGIN");
      try {
        const result = await action(runner(db));
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
