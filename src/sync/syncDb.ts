/**
 * Minimal database access of the sync engine. The app passes SQLocal, tests pass `node:sqlite`
 * (`src/test/syncTestDb.ts`), so the engine runs in both.
 */

/** A value SQLite can bind or return. */
export type SqlValue = string | number | null | Uint8Array;

/** Statement runner; also the handle inside a transaction. */
export type SqlRunner = {
  /** Runs a query and returns all rows. */
  all<T = Record<string, SqlValue>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<T[]>;
  /** Runs a statement without result rows. */
  run(sql: string, params?: SqlValue[]): Promise<void>;
};

/** Database of the sync engine. */
export type SyncDb = SqlRunner & {
  /** Runs `action` in one transaction; rolls back if it throws. */
  transaction<T>(action: (tx: SqlRunner) => Promise<T>): Promise<T>;
};
