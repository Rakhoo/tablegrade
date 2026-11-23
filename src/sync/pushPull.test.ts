import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { generateDataKey, type DataKey } from "../crypto/keys";
import { encryptRecord, recordId } from "../crypto/records";
import { SCHEMA_VERSION } from "../db/migrations";
import { createFakeServer } from "../test/fakeSyncServer";
import { openTestDb } from "../test/sqliteDb";
import { asSyncDb } from "../test/syncTestDb";
import type { SyncContext } from "./context";
import { applyPending, pullChanges } from "./pull";
import { pushChanges } from "./push";

const CLASS = "c0000000-0000-4000-8000-000000000001";
const ANNA = "50000000-0000-4000-8000-000000000001";
const PHOTO = "data:image/png;base64,iVBORw0KGgo=";

/** A device with its own database, sync enabled, on the shared fake server. */
function createDevice(
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
function seed(db: DatabaseSync) {
  db.exec(`
    INSERT INTO Classes (id, subject, number, letter, year, part, day, hour, double)
      VALUES ('${CLASS}', 'Mathe', '7', 'a', 2025, '1', 1, 2, 0);
    INSERT INTO Students (id, firstName, lastName) VALUES ('${ANNA}', 'Anna', 'Arm');
    INSERT INTO Classes2Students (classId, studentId) VALUES ('${CLASS}', '${ANNA}');
    INSERT INTO Grades (id, date, classId, studentId, grade)
      VALUES ('g1', '2025-09-01', '${CLASS}', '${ANNA}', 2);
  `);
}

describe("push and pull between two devices", () => {
  let server: ReturnType<typeof createFakeServer>;
  let a: ReturnType<typeof createDevice>;
  let b: ReturnType<typeof createDevice>;

  beforeEach(async () => {
    server = createFakeServer();
    const key = await generateDataKey();
    a = createDevice(server, key, "device-a");
    b = createDevice(server, key, "device-b");
  });

  it("creates, changes and deletes with cascade", async () => {
    seed(a.raw);
    await a.sync();
    expect(a.rows("SELECT * FROM _outbox")).toEqual([]);
    expect((await b.sync()).applied).toBe(4);
    expect(b.rows("SELECT grade FROM Grades")).toEqual([{ grade: 2 }]);
    expect(b.rows("SELECT * FROM _outbox")).toEqual([]);

    b.raw.exec("UPDATE Grades SET grade = 1");
    await b.sync();
    await a.sync();
    expect(a.rows("SELECT grade FROM Grades")).toEqual([{ grade: 1 }]);

    a.raw.exec(`DELETE FROM Students WHERE id = '${ANNA}'`);
    await a.sync();
    await b.sync();
    expect(b.rows("SELECT * FROM Students")).toEqual([]);
    expect(b.rows("SELECT * FROM Grades")).toEqual([]);
    expect(b.rows("SELECT * FROM Classes2Students")).toEqual([]);
    expect(b.rows("SELECT id FROM Classes")).toEqual([{ id: CLASS }]);
  });

  it("syncs photos as blobs and uploads each photo once", async () => {
    seed(a.raw);
    a.raw.exec(`UPDATE Students SET image = '${PHOTO}'`);
    await a.sync();
    a.raw.exec("UPDATE Students SET nickname = 'Anni'");
    await a.sync();
    expect(server.blobUploads()).toBe(1);
    await b.sync();
    expect(b.rows("SELECT image, nickname FROM Students")).toEqual([
      { image: PHOTO, nickname: "Anni" },
    ]);
  });

  it("keeps changes made during a push", async () => {
    seed(a.raw);
    const push = a.ctx.api.push;
    a.ctx.api.push = async (records) => {
      a.raw.exec("UPDATE Grades SET grade = 5");
      a.ctx.api.push = push;
      return push(records);
    };
    await pushChanges(a.ctx);
    // The change during the first batch is pushed in the next one
    expect(a.rows("SELECT * FROM _outbox")).toEqual([]);
    await b.sync();
    expect(b.rows("SELECT grade FROM Grades")).toEqual([{ grade: 5 }]);
  });

  it("lets the last push win after an offline phase", async () => {
    seed(a.raw);
    await a.sync();
    await b.sync();
    a.raw.exec("UPDATE Classes SET subject = 'Physik'");
    b.raw.exec("UPDATE Classes SET subject = 'Chemie'");
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.rows("SELECT subject FROM Classes")).toEqual([
      { subject: "Chemie" },
    ]);
    expect(b.rows("SELECT subject FROM Classes")).toEqual([
      { subject: "Chemie" },
    ]);
  });

  it("does not overwrite an unpushed local change", async () => {
    seed(a.raw);
    await a.sync();
    await b.sync();
    a.raw.exec("UPDATE Grades SET grade = 4");
    await a.sync();
    b.raw.exec("UPDATE Grades SET grade = 3");
    await pullChanges(b.ctx);
    expect(b.rows("SELECT grade FROM Grades")).toEqual([{ grade: 3 }]);
    await b.sync();
    await a.sync();
    expect(a.rows("SELECT grade FROM Grades")).toEqual([{ grade: 3 }]);
  });

  it("settles two grades for the same lesson the same way on both devices", async () => {
    seed(a.raw);
    await a.sync();
    await b.sync();
    a.raw.exec(`INSERT INTO Grades (id, date, classId, studentId, grade)
      VALUES ('g-a', '2025-09-08', '${CLASS}', '${ANNA}', 1)`);
    b.raw.exec(`INSERT INTO Grades (id, date, classId, studentId, grade)
      VALUES ('g-b', '2025-09-08', '${CLASS}', '${ANNA}', 6)`);
    await a.sync();
    await b.sync();
    await a.sync();
    await b.sync();
    const query = "SELECT id FROM Grades WHERE date = '2025-09-08'";
    expect(a.rows(query)).toEqual([{ id: "g-b" }]);
    expect(b.rows(query)).toEqual([{ id: "g-b" }]);
    const deleted = [...server.records.values()].filter((r) => r.deleted);
    expect(deleted).toHaveLength(1);
  });

  it("drops a pulled grade of a student deleted here", async () => {
    seed(a.raw);
    await a.sync();
    await b.sync();
    a.raw.exec(`DELETE FROM Students WHERE id = '${ANNA}'`);
    b.raw.exec(`INSERT INTO Grades (id, date, classId, studentId, grade)
      VALUES ('g2', '2025-09-08', '${CLASS}', '${ANNA}', 1)`);
    await b.sync();
    await pullChanges(a.ctx);
    expect(a.rows("SELECT * FROM Grades")).toEqual([]);
    await a.sync();
    await b.sync();
    expect(b.rows("SELECT * FROM Students")).toEqual([]);
  });

  it("defers records of a newer schema and applies them after an update", async () => {
    const id = await recordId(a.ctx.key, "Settings", ["theme"]);
    const newer = async (schema: number) => ({
      id,
      deleted: false,
      schema,
      blobs: [],
      ciphertext: await encryptRecord(a.ctx.key, "u", id, {
        t: "Settings",
        k: ["theme"],
        v: schema,
        row: { key: "theme", value: '"mint"' },
      }),
    });
    await server.api("device-new").push([await newer(SCHEMA_VERSION + 1)]);
    expect(await b.sync()).toEqual({ applied: 0, deferred: 1 });
    expect(b.rows("SELECT * FROM Settings WHERE key = 'theme'")).toEqual([]);

    // Simulates the app update: the waiting record now has a known schema
    b.raw.exec(`UPDATE _sync_pending SET schema = ${SCHEMA_VERSION}`);
    expect(await applyPending(b.ctx)).toBe(1);
    expect(b.rows("SELECT value FROM Settings WHERE key = 'theme'")).toEqual([
      { value: '"mint"' },
    ]);
    expect(b.rows("SELECT * FROM _sync_pending")).toEqual([]);
  });

  it("never syncs device settings", async () => {
    a.raw.exec(
      `INSERT INTO Settings (key, value) VALUES ('colorMode', '"dark"')`,
    );
    await a.sync();
    expect(server.records.size).toBe(0);
  });
});
