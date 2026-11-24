import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDataKey } from "../crypto/keys";
import { encryptRecord, recordId } from "../crypto/records";
import { SCHEMA_VERSION } from "../db/migrations";
import { createFakeServer } from "../test/fakeSyncServer";
import {
  ANNA,
  CLASS,
  createDevice,
  PHOTO,
  seed,
  type TestDevice,
} from "../test/syncDevices";
import { applyPending, pullChanges } from "./pull";
import { pushChanges } from "./push";

describe("push and pull between two devices", () => {
  let server: ReturnType<typeof createFakeServer>;
  let a: TestDevice;
  let b: TestDevice;

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
    // Decrypting counts records, then the photo download counts photos
    const progress = vi.fn();
    await pullChanges(b.ctx, progress);
    expect(progress).toHaveBeenCalledWith(0, expect.any(Number));
    expect(progress).toHaveBeenCalledWith(1, 1, "photos");
    // Writing has no count; the UI shows a running bar
    expect(progress).toHaveBeenLastCalledWith(0, 0);
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
    expect(await b.sync()).toMatchObject({ applied: 0, deferred: 1 });
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
