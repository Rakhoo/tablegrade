import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bytes } from "../crypto/encoding";
import { generateDataKey } from "../crypto/keys";
import { randomBytes } from "../crypto/primitives";
import type { Api, KeyWrap } from "./api";
import { createMemoryStore } from "./deviceStore";
import { addPasskey, unlockWithPasskey } from "./passkeyFlow";
import { createPasskey, evaluatePrf, type PasskeyResult } from "./webauthn";

vi.mock("./webauthn", async (original) => ({
  ...(await original<typeof import("./webauthn")>()),
  createPasskey: vi.fn(),
  evaluatePrf: vi.fn(),
}));

/** Relying party id of the server; differs from the page's host in the dev preview. */
const RP_ID = "tablegrade.pages.dev";

/** A passkey as the browser returns it. */
const passkey = (
  credentialId: string,
  prfOutput: Bytes | null,
): PasskeyResult => ({
  json: {} as PasskeyResult["json"],
  credentialId,
  prfCapable: !!prfOutput,
  prfOutput,
});

/** Fake server that keeps wraps and counts finished registrations. */
function fakeApi() {
  const wraps: KeyWrap[] = [];
  const finish = vi.fn();
  const api = {
    passkeyRegisterBegin: async () => ({
      challengeId: "c",
      options: { rp: { id: RP_ID } },
    }),
    session: async () => ({ rpId: RP_ID }),
    passkeyRegisterFinish: finish,
    listKeys: async () => wraps,
    putKey: async (wrap: KeyWrap) => void wraps.push(wrap),
  } as unknown as Api;
  return { api, wraps, finish };
}

/** Device store of an unlocked device of user `u`. */
async function unlockedStore() {
  const store = createMemoryStore();
  await store.set("session", { token: "t", userId: "u", deviceId: "d" });
  await store.set("dataKey", { userId: "u", key: await generateDataKey() });
  return store;
}

describe("passkey flow", () => {
  beforeEach(() => vi.mocked(evaluatePrf).mockReset());

  it("refuses a passkey without PRF before the server learns about it", async () => {
    const { api, finish, wraps } = fakeApi();
    vi.mocked(createPasskey).mockResolvedValue(passkey("hello", null));
    await expect(
      addPasskey({ api, store: await unlockedStore() }),
    ).rejects.toThrow("Google Passwortmanager");
    expect(finish).not.toHaveBeenCalled();
    expect(wraps).toEqual([]);
  });

  it("unlocks with a passkey picked from all passkeys, but only one with a wrap", async () => {
    const { api } = fakeApi();
    const prf = randomBytes(32);
    vi.mocked(createPasskey).mockResolvedValue(passkey("gpm", prf));
    await addPasskey({ api, store: await unlockedStore() });

    const fresh = createMemoryStore();
    await fresh.set("session", { token: "t", userId: "u", deviceId: "e" });
    vi.mocked(evaluatePrf).mockResolvedValue(passkey("other", randomBytes(32)));
    await expect(unlockWithPasskey({ api, store: fresh })).rejects.toThrow(
      "nicht zum Entsperren eingerichtet",
    );
    vi.mocked(evaluatePrf).mockResolvedValue(passkey("gpm", prf));
    await unlockWithPasskey({ api, store: fresh });
    expect(await fresh.get("dataKey")).toBeDefined();
    // No credential list, so Chrome on Windows offers its own passkeys, and the server's
    // relying party id, so the dev preview finds passkeys of the main domain
    expect(evaluatePrf).toHaveBeenCalledWith([], RP_ID);
  });
});
