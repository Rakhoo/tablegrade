import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "../test/memoryStorage";
import { createFakeServer } from "../test/fakeSyncServer";
import { createDevice, seed, type TestDevice } from "../test/syncDevices";
import { generateDataKey } from "../crypto/keys";
import type { Api, KeyWrap } from "./api";
import { createMemoryStore, type DeviceStore } from "./deviceStore";
import { completeSignIn } from "./keyring";
import { createSyncService, type SyncService } from "./service";
import type { SocketLike } from "./socket";
import { readStatus, updateStatus, OFF_STATUS } from "./status";

/** One account on a fake server: records, key wraps and the account calls. */
function fakeAccount() {
  const server = createFakeServer();
  const keys = new Map<string, KeyWrap>();
  let deleted = false;
  /** API client of one device. */
  const api = (deviceId: string) =>
    ({
      ...(server.api(deviceId) as object),
      session: async () => ({
        userId: "u",
        deviceId,
        identities: [],
        devices: [],
        approved: true,
        contactEmail: null,
        accessNote: null,
      }),
      listKeys: async () => [...keys.values()],
      putKey: async (wrap: KeyWrap) => void keys.set(wrap.id, wrap),
      deleteKey: async (id: string) => void keys.delete(id),
      logout: async () => {},
      deleteAccount: async () => void (deleted = true),
      socketUrl: () => "wss://test/ws",
    }) as unknown as Api;
  return { server, api, deleted: () => deleted };
}

/** Event target with the parts the session monitor uses. */
const targets = () => ({
  window: new EventTarget(),
  document: Object.assign(new EventTarget(), {
    visibilityState: "visible" as const,
  }),
});

/** A WebSocket that never connects; the tests trigger syncs by hand. */
const silentSocket = () => ({ send() {}, close() {} }) as unknown as SocketLike;

type Setup = {
  device: TestDevice;
  store: DeviceStore;
  service: SyncService;
  api: Api;
};

/** A device with sync off, signed in to user `u`, and its service. */
async function setupDevice(
  account: ReturnType<typeof fakeAccount>,
  deviceId: string,
  isNewUser: boolean,
): Promise<Setup> {
  const device = createDevice(
    account.server,
    await generateDataKey(),
    deviceId,
  );
  device.raw.exec("DELETE FROM _sync_state");
  const store = createMemoryStore();
  const api = account.api(deviceId);
  const service = createSyncService({
    db: device.ctx.db,
    store,
    createApi: () => api,
    storage: memoryStorage(),
    currentUrl: () => "https://app.test/#/settings",
    navigate: () => {},
    replaceUrl: () => {},
    monitorTargets: targets(),
    createSocket: silentSocket,
  });
  await completeSignIn(
    { api, store },
    { sessionToken: "t", userId: "u", deviceId, isNewUser },
    null,
  );
  return { device, store, service, api };
}

/** First device: new account with data, sync on and the recovery key created. */
async function firstDevice(account: ReturnType<typeof fakeAccount>) {
  const a = await setupDevice(account, "device-a", true);
  seed(a.device.raw);
  await a.service.enableSync();
  const recovery = await a.service.createRecoveryKey();
  await a.service.syncNow();
  return { a, recovery };
}

describe("sync service", () => {
  afterEach(() => updateStatus(OFF_STATUS));

  it("uploads a new account after its recovery key and downloads it on a new device", async () => {
    const account = fakeAccount();
    const a = await setupDevice(account, "device-a", true);
    seed(a.device.raw);
    await a.service.enableSync();
    expect(account.server.records.size).toBe(0);
    const recovery = await a.service.createRecoveryKey();
    await a.service.syncNow();
    expect(account.server.records.size).toBe(4);
    expect(readStatus().phase).toBe("idle");

    const b = await setupDevice(account, "device-b", false);
    await b.service.enableSync();
    expect(readStatus().phase).toBe("locked");
    const applied = vi.fn();
    b.service.subscribeApplied(applied);
    await b.service.unlockWithRecoveryKey(recovery);
    await b.service.syncNow();
    expect(b.device.rows("SELECT subject FROM Classes")).toEqual([
      { subject: "Mathe" },
    ]);
    expect(applied).toHaveBeenCalled();
  });

  it("replaces own local data only after the user agreed", async () => {
    const account = fakeAccount();
    const { recovery } = await firstDevice(account);
    const b = await setupDevice(account, "device-b", false);
    seed(b.device.raw);
    b.device.raw.exec("UPDATE Classes SET subject = 'Kunst'");
    await b.service.enableSync();
    await b.service.unlockWithRecoveryKey(recovery);
    expect(await b.service.hasLocalData()).toBe(true);
    expect(b.device.rows("SELECT * FROM _outbox")).toEqual([]);

    await b.service.replaceLocalData();
    await b.service.syncNow();
    expect(b.device.rows("SELECT subject FROM Classes")).toEqual([
      { subject: "Mathe" },
    ]);
  });

  it("turns off, deletes the account and keeps the local data", async () => {
    const account = fakeAccount();
    const { a } = await firstDevice(account);
    await a.service.disableSync();
    expect(readStatus().phase).toBe("off");
    expect(await a.store.get("session")).toBeUndefined();
    expect(await a.store.get("dataKey")).toBeDefined();

    await a.service.enableSync();
    expect(readStatus().phase).toBe("signedOut");
    await completeSignIn(
      { api: a.api, store: a.store },
      {
        sessionToken: "t",
        userId: "u",
        deviceId: "device-a",
        isNewUser: false,
      },
      null,
    );
    await a.service.deleteAccount();
    expect(account.deleted()).toBe(true);
    expect(await a.store.get("dataKey")).toBeUndefined();
    expect(a.device.rows("SELECT id FROM Classes")).toHaveLength(1);
  });

  it("keeps the import hint after a backup import until dismissed", async () => {
    const account = fakeAccount();
    const { a } = await firstDevice(account);
    // An imported file carries no or another activation
    a.device.raw.exec("DELETE FROM _sync_state WHERE key = 'syncId'");
    await a.service.start();
    a.service.stop();
    expect(readStatus().phase).toBe("off");
    expect(readStatus().importNotice).toBe(true);
    expect(await a.store.get("wanted")).toBeUndefined();

    // A restart still shows the hint; dismissing removes it for good
    await a.service.start();
    a.service.stop();
    expect(readStatus().importNotice).toBe(true);
    await a.service.dismissImportNotice();
    expect(readStatus().importNotice).toBe(false);
    expect(await a.store.get("importNotice")).toBeUndefined();
  });

  it("clears the import hint when sync is turned on again", async () => {
    const account = fakeAccount();
    const { a } = await firstDevice(account);
    a.device.raw.exec("DELETE FROM _sync_state WHERE key = 'syncId'");
    await a.service.start();
    a.service.stop();
    await a.service.enableSync();
    expect(readStatus().importNotice).toBe(false);
    expect(await a.store.get("importNotice")).toBeUndefined();
  });
});
