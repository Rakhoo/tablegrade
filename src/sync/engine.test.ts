import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDataKey } from "../crypto/keys";
import { recordId } from "../crypto/records";
import { createFakeServer } from "../test/fakeSyncServer";
import {
  ANNA,
  CLASS,
  createDevice,
  seed,
  type TestDevice,
} from "../test/syncDevices";
import { ApiError } from "./api";
import { turnOff, turnOn } from "./activation";
import { createSyncEngine, runSync, type EngineOptions } from "./engine";
import { openSocket, type SocketLike } from "./socket";
import type { SyncStatus } from "./types";

describe("activation and sync runs", () => {
  let server: ReturnType<typeof createFakeServer>;
  let a: TestDevice;
  let b: TestDevice;

  beforeEach(async () => {
    server = createFakeServer();
    const key = await generateDataKey();
    a = createDevice(server, key, "device-a");
    b = createDevice(server, key, "device-b");
  });

  it("uploads all existing rows when sync is turned on", async () => {
    a.raw.exec("UPDATE _sync_state SET value = '0' WHERE key = 'enabled'");
    seed(a.raw);
    a.raw.exec(`INSERT INTO Settings (key, value)
      VALUES ('colorMode', '"dark"'), ('theme', '"mint"')`);
    expect(a.rows("SELECT * FROM _outbox")).toEqual([]);
    await turnOn(a.ctx.db, "sync-1");
    const progress = vi.fn();
    await runSync(a.ctx, progress);
    expect(progress).toHaveBeenCalledWith(5, 5);
    expect(server.records.size).toBe(5);
    expect((await runSync(b.ctx)).applied).toBe(5);
    expect(b.rows("SELECT key FROM Settings")).toEqual([{ key: "theme" }]);
  });

  it("turns off without touching the data", async () => {
    seed(a.raw);
    await turnOff(a.ctx.db);
    a.raw.exec("UPDATE Grades SET grade = 1");
    expect(a.rows("SELECT * FROM _outbox")).toEqual([]);
    expect(
      a.rows("SELECT value FROM _sync_state WHERE key = 'enabled'"),
    ).toEqual([{ value: "0" }]);
    expect(a.rows("SELECT grade FROM Grades")).toEqual([{ grade: 1 }]);
  });

  it("reloads everything after 410 without losing local changes", async () => {
    seed(a.raw);
    await runSync(a.ctx);
    await runSync(b.ctx);
    b.raw.exec("UPDATE Grades SET grade = 6");
    a.raw.exec("UPDATE Classes SET subject = 'Physik'");
    await runSync(a.ctx);
    server.prune(await recordId(a.ctx.key, "Students", [ANNA]));

    await runSync(b.ctx);
    expect(b.rows("SELECT subject FROM Classes")).toEqual([
      { subject: "Physik" },
    ]);
    expect(b.rows("SELECT grade FROM Grades")).toEqual([{ grade: 6 }]);
    expect(b.rows("SELECT * FROM _outbox")).toEqual([]);
    // The forgotten student is uploaded again
    expect(
      server.records.has(await recordId(a.ctx.key, "Students", [ANNA])),
    ).toBe(true);
  });

  it("uploads everything again after the server was restored", async () => {
    seed(a.raw);
    await runSync(a.ctx);
    await runSync(b.ctx);
    const backupSeq = Math.max(
      ...[...server.records.values()].map((r) => r.seq),
    );
    a.raw.exec("UPDATE Classes SET subject = 'Physik'");
    await runSync(a.ctx);
    await runSync(b.ctx);
    server.restore(backupSeq);

    await runSync(b.ctx);
    expect(b.rows("SELECT * FROM _outbox")).toEqual([]);
    const c = createDevice(server, a.ctx.key, "device-c");
    await runSync(c.ctx);
    expect(c.rows("SELECT subject FROM Classes")).toEqual([
      { subject: "Physik" },
    ]);
  });
});

/** Fake WebSocket that the test drives by hand. */
class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor() {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  /** Delivers a server message. */
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

/** Creates fake sockets for `openSocket`. */
const createFake = () => new FakeSocket() as unknown as SocketLike;

describe("openSocket", () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings, reconnects with backoff and stops", () => {
    const messages: unknown[] = [];
    const close = openSocket(
      () => "wss://x/ws",
      (m) => messages.push(m),
      createFake,
    );
    const [first] = FakeSocket.all;
    first.onopen?.();
    vi.advanceTimersByTime(30_000);
    expect(first.sent).toEqual(['{"type":"ping"}']);
    first.receive({ type: "changed", latestSeq: 3, deviceId: "d" });
    first.onmessage?.({ data: "no json" });
    expect(messages).toEqual([
      { type: "changed", latestSeq: 3, deviceId: "d" },
    ]);

    first.onclose?.();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1].onclose?.();
    vi.advanceTimersByTime(2_000);
    expect(FakeSocket.all).toHaveLength(3);

    close();
    expect(FakeSocket.all[2].closed).toBe(true);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(3);
  });
});

describe("createSyncEngine", () => {
  let server: ReturnType<typeof createFakeServer>;
  let a: TestDevice;
  let statuses: Partial<SyncStatus>[];
  let options: EngineOptions;

  beforeEach(async () => {
    FakeSocket.all = [];
    server = createFakeServer();
    a = createDevice(server, await generateDataKey(), "device-a");
    statuses = [];
    options = {
      getContext: async () => a.ctx,
      socketUrl: () => "wss://x/ws",
      onStatus: (change) => statuses.push(change),
      onApplied: vi.fn(),
      onLink: vi.fn(),
      createSocket: createFake,
    };
  });

  it("syncs on hello and on changes of other devices", async () => {
    const engine = createSyncEngine(options);
    engine.start();
    const socket = FakeSocket.all[0];
    socket.receive({ type: "hello", latestSeq: 0 });
    await engine.requestSync();
    expect(statuses.at(-1)).toMatchObject({ phase: "idle", pending: 0 });

    const other = createDevice(server, a.ctx.key, "device-b");
    seed(other.raw);
    await other.sync();
    statuses = [];
    socket.receive({ type: "changed", latestSeq: 4, deviceId: "device-a" });
    expect(statuses).toEqual([]);
    socket.receive({ type: "changed", latestSeq: 4, deviceId: "device-b" });
    await engine.requestSync();
    expect(options.onApplied).toHaveBeenCalled();
    expect(a.rows("SELECT id FROM Classes")).toEqual([{ id: CLASS }]);

    socket.receive({ type: "link", linkId: "l1" });
    expect(options.onLink).toHaveBeenCalledWith("l1");
    engine.stop();
  });

  it("stops on revoked and keeps working locally", () => {
    const engine = createSyncEngine(options);
    engine.start();
    FakeSocket.all[0].receive({ type: "revoked" });
    expect(FakeSocket.all[0].closed).toBe(true);
    expect(statuses.at(-1)).toMatchObject({
      phase: "signedOut",
      account: null,
    });
  });

  it("reports offline and upgrade states", async () => {
    a.ctx.api.pull = async () => {
      throw new ApiError("offline", 0);
    };
    const engine = createSyncEngine(options);
    await engine.requestSync();
    expect(statuses.at(-1)).toMatchObject({ phase: "offline" });
    a.ctx.api.pull = async () => {
      throw new ApiError("upgrade_required", 426);
    };
    await engine.requestSync();
    expect(statuses.at(-1)).toMatchObject({ phase: "upgradeRequired" });
    a.ctx.api.pull = async () => {
      throw new TypeError("broken");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await engine.requestSync();
    expect(statuses.at(-1)).toMatchObject({ phase: "error" });
  });

  it("does nothing without a context", async () => {
    options.getContext = async () => null;
    await createSyncEngine(options).requestSync();
    expect(statuses).toEqual([]);
  });
});
