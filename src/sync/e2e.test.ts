/**
 * End-to-end test of client and Go server: two or three simulated devices with
 * `node:sqlite` talk to a real server over HTTP and WebSocket. Runs with `npm run test:e2e`;
 * needs Go. Each device loads its own copy of the sync modules, because the status is a
 * module-level value per app.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SessionGrant } from "./api";
import { startGoServer } from "../test/goServer";
import { memoryStorage } from "../test/memoryStorage";
import { openTestDb } from "../test/sqliteDb";
import { ANNA, CLASS, PHOTO, seed } from "../test/syncDevices";
import { asSyncDb } from "../test/syncTestDb";

/** Wait options for changes that arrive over the WebSocket. */
const ARRIVAL = { timeout: 15_000, interval: 100 };
/** Student added with a photo. */
const BEN = "50000000-0000-4000-8000-000000000002";

let server: Awaited<ReturnType<typeof startGoServer>>;
/** Services to stop after the suite. */
const services: { stop: () => void }[] = [];

/** Signs in a device with the dev login; a new account without `userId`. */
async function devLogin(deviceName: string, userId?: string) {
  const response = await fetch(`${server.baseUrl}/api/v1/auth/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Protocol-Version": "1" },
    body: JSON.stringify({ deviceName, userId }),
  });
  if (!response.ok) throw new Error(`dev login: ${response.status}`);
  return (await response.json()) as SessionGrant;
}

type Device = Awaited<ReturnType<typeof createDevice>>;

/** A device with its own database, device store, modules and network switch. */
async function createDevice(name: string, userId?: string) {
  vi.resetModules();
  const { createSyncService } = await import("./service");
  const { readStatus } = await import("./status");
  const { createApi } = await import("./api");
  const { completeSignIn } = await import("./keyring");
  const { createMemoryStore } = await import("./deviceStore");

  const raw = openTestDb();
  const store = createMemoryStore();
  let online = true;
  // Offline means every request fails like a missing network in the browser
  const doFetch: typeof fetch = (input, init) =>
    online ? fetch(input, init) : Promise.reject(new TypeError("offline"));
  const service = createSyncService({
    db: asSyncDb(raw),
    store,
    createApi: (getToken) =>
      createApi({ baseUrl: server.baseUrl, getToken, fetch: doFetch }),
    storage: memoryStorage(),
    currentUrl: () => "http://localhost/#/settings",
    navigate: () => {},
    replaceUrl: () => {},
    monitorTargets: {
      window: new EventTarget(),
      document: Object.assign(new EventTarget(), {
        visibilityState: "visible" as const,
      }),
    },
  });
  const grant = await devLogin(name, userId);
  const api = createApi({
    baseUrl: server.baseUrl,
    getToken: () => grant.sessionToken,
  });
  await completeSignIn({ api, store }, grant, null);
  const device = {
    raw,
    service,
    grant,
    /** Status of this device. */
    status: readStatus,
    /** Switches the simulated network. */
    setOnline: (value: boolean) => void (online = value),
    /** All rows of a query. */
    rows: (sql: string) => raw.prepare(sql).all() as Record<string, unknown>[],
  };
  services.push(service);
  return device;
}

/** Grade of Anna on a device. */
const gradeOf = (device: Device) =>
  device.rows(`SELECT grade FROM Grades WHERE studentId = '${ANNA}'`);

/** Subject of the class on a device. */
const subjectOf = (device: Device) =>
  device.rows(`SELECT subject FROM Classes WHERE id = '${CLASS}'`);

describe("client and server end to end", () => {
  let a: Device;
  let b: Device;
  let c: Device;
  let recovery: string;

  beforeAll(async () => {
    server = await startGoServer();
  });

  afterAll(async () => {
    services.forEach((service) => service.stop());
    await server?.close();
  });

  it("uploads all data of the first device", async () => {
    a = await createDevice("iPad");
    seed(a.raw);
    await a.service.enableSync();
    recovery = await a.service.createRecoveryKey();
    await a.service.syncNow();
    expect(a.status().phase).toBe("idle");
    expect(a.rows("SELECT * FROM _outbox")).toEqual([]);
  });

  it("downloads everything on a second device with the recovery key", async () => {
    b = await createDevice("PC", a.grant.userId);
    await b.service.enableSync();
    expect(b.status().phase).toBe("locked");
    await b.service.unlockWithRecoveryKey(recovery);
    await b.service.syncNow();
    expect(subjectOf(b)).toEqual([{ subject: "Mathe" }]);
    expect(gradeOf(b)).toEqual([{ grade: 2 }]);
    expect(b.status().phase).toBe("idle");
    // State for the restore test at the end
    await server.snapshot("after-second-device");
  });

  it("links a third device with a code", async () => {
    c = await createDevice("Laptop", a.grant.userId);
    await c.service.enableSync();
    expect(c.status().phase).toBe("locked");
    const pending = await c.service.startDeviceLink();
    const approval = await a.service.confirmDeviceLink(pending.code);
    await approval.approve();
    expect(await pending.checkCode).toBe(approval.checkCode);
    await pending.accept();
    await c.service.syncNow();
    expect(subjectOf(c)).toEqual([{ subject: "Mathe" }]);
  });

  it("keeps the last written grade on all devices", async () => {
    a.raw.exec(`UPDATE Grades SET grade = 1 WHERE studentId = '${ANNA}'`);
    b.raw.exec(`UPDATE Grades SET grade = 5 WHERE studentId = '${ANNA}'`);
    await a.service.syncNow();
    await b.service.syncNow();
    // A and C learn about the change over the WebSocket
    for (const device of [a, b, c])
      await vi.waitFor(
        () => expect(gradeOf(device)).toEqual([{ grade: 5 }]),
        ARRIVAL,
      );
  });

  it("sends a photo to the other devices", async () => {
    a.raw.exec(`
      INSERT INTO Students (id, firstName, lastName, image)
        VALUES ('${BEN}', 'Ben', 'Berg', '${PHOTO}');
      INSERT INTO Classes2Students (classId, studentId) VALUES ('${CLASS}', '${BEN}');
    `);
    await a.service.syncNow();
    await vi.waitFor(
      () =>
        expect(
          b.rows(`SELECT image FROM Students WHERE id = '${BEN}'`),
        ).toEqual([{ image: PHOTO }]),
      ARRIVAL,
    );
  });

  it("deletes a student with grades and class membership", async () => {
    a.raw.exec(`DELETE FROM Students WHERE id = '${ANNA}'`);
    await a.service.syncNow();
    await vi.waitFor(() => {
      expect(b.rows(`SELECT id FROM Students WHERE id = '${ANNA}'`)).toEqual(
        [],
      );
      expect(gradeOf(b)).toEqual([]);
      expect(
        b.rows(`SELECT * FROM Classes2Students WHERE studentId = '${ANNA}'`),
      ).toEqual([]);
    }, ARRIVAL);
  });

  it("sends changes made offline after the network is back", async () => {
    b.setOnline(false);
    b.raw.exec(`UPDATE Classes SET subject = 'Physik' WHERE id = '${CLASS}'`);
    await b.service.syncNow();
    expect(b.status().phase).toBe("offline");
    expect(subjectOf(a)).toEqual([{ subject: "Mathe" }]);

    b.setOnline(true);
    await b.service.syncNow();
    expect(b.status().phase).toBe("idle");
    await vi.waitFor(
      () => expect(subjectOf(a)).toEqual([{ subject: "Physik" }]),
      ARRIVAL,
    );
  });

  it("shows a hint on a revoked device and keeps its data", async () => {
    await a.service.revokeDevice(c.grant.deviceId);
    await vi.waitFor(() => {
      expect(c.status().phase).toBe("signedOut");
      expect(c.status().error).toBeTruthy();
    }, ARRIVAL);
    expect(subjectOf(c)).not.toEqual([]);
  });

  it("uploads the data again after the server was restored from a backup", async () => {
    await server.restore("after-second-device");
    await a.service.syncNow();
    await b.service.syncNow();
    await a.service.syncNow();
    for (const device of [a, b]) {
      expect(device.status().phase).toBe("idle");
      expect(subjectOf(device)).toEqual([{ subject: "Physik" }]);
      expect(
        device.rows(`SELECT image FROM Students WHERE id = '${BEN}'`),
      ).toEqual([{ image: PHOTO }]);
      // Deletions after the backup come back on all devices (accepted for this rare case)
      expect(gradeOf(device)).toEqual([{ grade: 2 }]);
    }
  });

  it("deletes the account and signs out the other devices", async () => {
    await a.service.deleteAccount();
    expect(a.status().phase).toBe("off");
    // B's socket may still wait to reconnect after the restore, so B notices on its next sync
    await b.service.syncNow();
    expect(b.status().phase).toBe("signedOut");
    expect(subjectOf(a)).toEqual([{ subject: "Physik" }]);
    expect(subjectOf(b)).toEqual([{ subject: "Physik" }]);
    await expect(devLogin("Neu", a.grant.userId)).rejects.toThrow();
  });
});
