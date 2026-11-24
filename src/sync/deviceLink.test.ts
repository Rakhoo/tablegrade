import { describe, expect, it } from "vitest";
import { generateDataKey } from "../crypto/keys";
import { createDevice, seed } from "../test/syncDevices";
import { createFakeServer } from "../test/fakeSyncServer";
import { deleteAccount } from "./account";
import { ApiError, type Api } from "./api";
import { createMemoryStore, type DeviceStore } from "./deviceStore";
import { findLink, startLink } from "./deviceLink";

/** Fake link endpoints of one account (protocol.md 6). */
function fakeLinkApi() {
  const links = new Map<
    string,
    { code: string; publicKey: string; key?: string; wrapped?: string }
  >();
  let deleted = false;
  const notFound = () => new ApiError("not_found", 404);
  const api = {
    startLink: async (publicKey: string) => {
      const linkId = crypto.randomUUID();
      const code = `CODE${links.size}`;
      links.set(linkId, { code, publicKey });
      return { linkId, code };
    },
    findLink: async (code: string) => {
      const entry = [...links].find(([, link]) => link.code == code);
      if (!entry) throw notFound();
      return { linkId: entry[0], publicKey: entry[1].publicKey };
    },
    setLinkKey: async (linkId: string, publicKey: string) => {
      const link = links.get(linkId);
      if (!link) throw notFound();
      link.key = publicKey;
    },
    completeLink: async (
      linkId: string,
      publicKey: string,
      wrapped: string,
    ) => {
      const link = links.get(linkId);
      if (!link) throw notFound();
      Object.assign(link, { key: publicKey, wrapped });
    },
    getLink: async (linkId: string) => {
      const link = links.get(linkId);
      if (!link) throw notFound();
      if (!link.key) return { status: "waiting" };
      if (!link.wrapped) return { status: "keyed", publicKey: link.key };
      links.delete(linkId);
      return { status: "done", publicKey: link.key, wrapped: link.wrapped };
    },
    deleteAccount: async () => void (deleted = true),
  } as unknown as Api;
  return { api, links, deleted: () => deleted };
}

/** Device store with a session of user `u`, optionally unlocked. */
async function signedIn(unlocked: boolean): Promise<DeviceStore> {
  const store = createMemoryStore();
  await store.set("session", { token: "t", userId: "u", deviceId: "d" });
  if (unlocked)
    await store.set("dataKey", { userId: "u", key: await generateDataKey() });
  return store;
}

/** Raw DEK bytes, to compare keys. */
const raw = async (store: DeviceStore) =>
  crypto.subtle.exportKey("raw", (await store.get("dataKey"))!.key.dek);

describe("device link", () => {
  it("hands the data key over after both check codes match", async () => {
    const { api } = fakeLinkApi();
    const oldDevice = await signedIn(true);
    const newDevice = await signedIn(false);
    const pending = await startLink({ api, store: newDevice }, 1);
    const approval = await findLink({ api, store: oldDevice }, pending.code);
    expect(approval.checkCode).toMatch(/^\d{6}$/);
    // Both devices show the code before the old device sends the data key
    expect(await pending.checkCode).toBe(approval.checkCode);
    const accepted = pending.accept();
    expect(await newDevice.get("dataKey")).toBeUndefined();
    await approval.approve();
    await accepted;
    expect(await raw(newDevice)).toEqual(await raw(oldDevice));
  });

  it("rejects wrong codes, locked old devices and cancelled links", async () => {
    const { api } = fakeLinkApi();
    const newDevice = await signedIn(false);
    const pending = await startLink({ api, store: newDevice }, 1);
    await expect(
      findLink({ api, store: await signedIn(true) }, "WRONG"),
    ).rejects.toThrow("falsch oder abgelaufen");
    await expect(
      findLink({ api, store: await signedIn(false) }, pending.code),
    ).rejects.toThrow("gesperrt");
    pending.cancel();
    await expect(pending.checkCode).rejects.toThrow("abgebrochen");
    await expect(pending.accept()).rejects.toThrow("abgebrochen");
  });

  it("reports an expired link", async () => {
    const { api, links } = fakeLinkApi();
    const pending = await startLink({ api, store: await signedIn(false) }, 1);
    links.clear();
    await expect(pending.checkCode).rejects.toThrow("abgelaufen");
  });
});

describe("deleteAccount", () => {
  it("removes server account, sync state and keys but keeps the data", async () => {
    const { api, deleted } = fakeLinkApi();
    const device = createDevice(
      createFakeServer(),
      await generateDataKey(),
      "d",
    );
    seed(device.raw);
    const store = await signedIn(true);
    await deleteAccount({ api, store }, device.ctx.db);
    expect(deleted()).toBe(true);
    expect(await store.get("dataKey")).toBeUndefined();
    expect(await store.get("session")).toBeUndefined();
    expect(device.rows("SELECT * FROM _outbox")).toEqual([]);
    expect(
      device.rows("SELECT value FROM _sync_state WHERE key = 'enabled'"),
    ).toEqual([{ value: "0" }]);
    expect(device.rows("SELECT id FROM Classes")).toHaveLength(1);
  });

  it("changes nothing locally when the server call fails", async () => {
    const api = {
      deleteAccount: async () => {
        throw new ApiError("offline", 0);
      },
    } as unknown as Api;
    const device = createDevice(
      createFakeServer(),
      await generateDataKey(),
      "d",
    );
    const store = await signedIn(true);
    await expect(deleteAccount({ api, store }, device.ctx.db)).rejects.toThrow(
      "Verbindung",
    );
    expect(await store.get("dataKey")).toBeDefined();
  });
});
