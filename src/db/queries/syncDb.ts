import type { SqlRunner, SqlValue, SyncDb } from "../../sync/syncDb";
import { client } from "../client";

/** Runner over a SQLocal `sql` function (client or transaction). */
function runner(sql: typeof client.sql): SqlRunner {
  return {
    all: async <T>(query: string, params: SqlValue[] = []) =>
      (await sql(query, ...params)) as T[],
    run: async (query, params = []) => {
      await sql(query, ...params);
    },
  };
}

/** The app database as seen by the sync engine (raw SQL on the sync tables). */
export const syncDb: SyncDb = {
  ...runner(client.sql),
  transaction: (action) => client.transaction((tx) => action(runner(tx.sql))),
};
