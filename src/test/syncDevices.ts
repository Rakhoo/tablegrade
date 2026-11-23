import type { DatabaseSync } from "node:sqlite";
import type { DataKey } from "../crypto/keys";
import type { SyncContext } from "../sync/context";
import { pullChanges } from "../sync/pull";
import { pushChanges } from "../sync/push";
import type { createFakeServer } from "./fakeSyncServer";
import { openTestDb } from "./sqliteDb";
import { asSyncDb } from "./syncTestDb";

export const CLASS = "c0000000-0000-4000-8000-000000000001";
export const ANNA = "50000000-0000-4000-8000-000000000001";
export const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

/** Test device as made by `createDevice`. */
export type TestDevice = ReturnType<typeof createDevice>;

/** A device with its own database, sync enabled, on the shared fake server. */
export function createDevice(
  server: ReturnType<typeof createFakeServer>,
  key: DataKey,
  deviceId: string,
) {
  const raw = openTestDb();
  raw.exec("INSERT INTO _sync_state (key, value) VALUES ('enabled', '1')");
  const ctx: SyncContext = {
    db: asSyncDb(raw),
    api: server.api(deviceId),
    key,
    userId: "u",
    deviceId,
  };
  return {
    raw,
    ctx,
    /** Push, then pull, like the engine does. */
    sync: async () => {
      await pushChanges(ctx);
      return pullChanges(ctx);
    },
    /** All rows of a query. */
    rows: (sql: string) => raw.prepare(sql).all() as Record<string, unknown>[],
  };
}

/** Adds a class with student Anna and a grade. */
export function seed(db: DatabaseSync) {
  db.exec(`
    INSERT INTO Classes (id, subject, number, letter, year, part, day, hour, double)
      VALUES ('${CLASS}', 'Mathe', '7', 'a', 2025, '1', 1, 2, 0);
    INSERT INTO Students (id, firstName, lastName) VALUES ('${ANNA}', 'Anna', 'Arm');
    INSERT INTO Classes2Students (classId, studentId) VALUES ('${CLASS}', '${ANNA}');
    INSERT INTO Grades (id, date, classId, studentId, grade)
      VALUES ('g1', '2025-09-01', '${CLASS}', '${ANNA}', 2);
  `);
}
