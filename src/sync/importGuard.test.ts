import { describe, expect, it } from "vitest";
import { openTestDb } from "../test/sqliteDb";
import { asSyncDb } from "../test/syncTestDb";
import { createMemoryStore } from "./deviceStore";
import { checkImportedDatabase } from "./importGuard";
import { readSyncState, writeSyncState } from "./syncState";

/** Test database plus device store with sync on and a pending outbox entry. */
async function setup(deviceSyncId: string | null, dbSyncId: string | null) {
  const db = asSyncDb(openTestDb());
  const store = createMemoryStore();
  if (deviceSyncId) {
    await store.set("syncId", deviceSyncId);
    await store.set("session", { token: "t", userId: "u", deviceId: "d" });
  }
  await writeSyncState(db, { enabled: "1", lastSeq: "42", syncId: dbSyncId });
  await db.run(
    "INSERT INTO _outbox (tbl, pk, changedAt) VALUES ('Classes', 'x', 1)",
  );
  const outboxSize = async () => (await db.all("SELECT * FROM _outbox")).length;
  return { db, store, outboxSize };
}

describe("syncState", () => {
  it("writes, replaces and removes values", async () => {
    const db = asSyncDb(openTestDb());
    await writeSyncState(db, { lastSeq: "1" });
    await writeSyncState(db, { lastSeq: "2" });
    expect(await readSyncState(db, "lastSeq")).toBe("2");
    await writeSyncState(db, { lastSeq: null });
    expect(await readSyncState(db, "lastSeq")).toBeNull();
  });
});

describe("checkImportedDatabase", () => {
  it("keeps everything when the ids match", async () => {
    const { db, store, outboxSize } = await setup("a", "a");
    expect(await checkImportedDatabase(db, store)).toBe("ok");
    expect(await readSyncState(db, "lastSeq")).toBe("42");
    expect(await outboxSize()).toBe(1);
    expect(await store.get("session")).toBeDefined();
  });

  it("keeps everything when sync was never on", async () => {
    const db = asSyncDb(openTestDb());
    expect(await checkImportedDatabase(db, createMemoryStore())).toBe("ok");
  });

  it("turns sync off after an import over active sync", async () => {
    const { db, store, outboxSize } = await setup("a", "b");
    expect(await checkImportedDatabase(db, store)).toBe("disabled");
    expect(await readSyncState(db, "enabled")).toBe("0");
    expect(await readSyncState(db, "lastSeq")).toBeNull();
    expect(await readSyncState(db, "syncId")).toBeNull();
    expect(await outboxSize()).toBe(0);
    expect(await store.get("session")).toBeUndefined();
    expect(await store.get("syncId")).toBeUndefined();
    expect(await store.get("importNotice")).toBe(true);
  });

  it("turns sync off when the backup has no sync state", async () => {
    const { db, store } = await setup("a", null);
    expect(await checkImportedDatabase(db, store)).toBe("disabled");
  });

  it("clears stale sync state from another device without a hint", async () => {
    const { db, store, outboxSize } = await setup(null, "b");
    expect(await checkImportedDatabase(db, store)).toBe("reset");
    expect(await readSyncState(db, "enabled")).toBe("0");
    expect(await outboxSize()).toBe(0);
    expect(await store.get("importNotice")).toBeUndefined();
  });

  it("keeps the data key", async () => {
    const { db, store } = await setup("a", "b");
    const dataKey = { userId: "u", key: {} as never };
    await store.set("dataKey", dataKey);
    await checkImportedDatabase(db, store);
    expect(await store.get("dataKey")).toBe(dataKey);
  });
});
