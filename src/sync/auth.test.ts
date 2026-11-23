import { memoryStorage } from "../test/memoryStorage";
import { describe, expect, it } from "vitest";
import { randomBytes } from "../crypto/primitives";
import { RecoveryKeyError } from "../crypto/recoveryKey";
import type { Api, KeyWrap, SessionGrant } from "./api";
import { createMemoryStore } from "./deviceStore";
import {
  addPasskeyWrap,
  completeSignIn,
  replaceRecoveryKey,
  signOut,
  unlockWithPrf,
  unlockWithRecovery,
} from "./keyring";
import {
  beginOidcLogin,
  finishOidcLogin,
  parseOidcCallback,
  withoutOidcQuery,
} from "./oidc";

/** Fake server holding key wraps; only the calls the keyring uses. */
function fakeApi() {
  const keys = new Map<string, KeyWrap>();
  let loggedOut = false;
  const api = {
    listKeys: async () => [...keys.values()],
    putKey: async (wrap: KeyWrap) => void keys.set(wrap.id, wrap),
    deleteKey: async (id: string) => void keys.delete(id),
    logout: async () => void (loggedOut = true),
    oidcConfig: async () => ({
      clientId: "client",
      authorizeUrl: "https://login.test/authorize",
      scopes: ["openid"],
      redirectUri: "https://app.test/?oidc=callback",
    }),
    oidcExchange: async (_provider: string, body: unknown) => ({
      sessionToken: "t",
      userId: "u",
      deviceId: "d",
      isNewUser: false,
      body,
    }),
  } as unknown as Api;
  return { api, keys, loggedOut: () => loggedOut };
}

/** Sign-in answer for user `u`. */
const grant = (isNewUser: boolean, deviceId = "d1"): SessionGrant => ({
  sessionToken: "token",
  userId: "u",
  deviceId,
  isNewUser,
});

const prf = { credentialId: "cred", prfOutput: randomBytes(32) };

describe("keyring", () => {
  it("creates the data key for a new account and unlocks a second device", async () => {
    const { api } = fakeApi();
    const first = createMemoryStore();
    expect(
      await completeSignIn({ api, store: first }, grant(true), prf),
    ).toEqual({ needsUnlock: false });
    const recovery = await replaceRecoveryKey({ api, store: first });
    expect(recovery).toMatch(/^([0-9A-Z]{4}-){8}[0-9A-Z]{4}$/);

    // Second device: the passkey alone unlocks it
    const second = createMemoryStore();
    expect(
      await completeSignIn({ api, store: second }, grant(false, "d2"), prf),
    ).toEqual({ needsUnlock: false });
    const firstKey = (await first.get("dataKey"))!.key;
    const secondKey = (await second.get("dataKey"))!.key;
    const raw = (key: CryptoKey) => crypto.subtle.exportKey("raw", key);
    expect(await raw(secondKey.dek)).toEqual(await raw(firstKey.dek));

    // Third device without PRF: locked until the recovery key is typed
    const third = createMemoryStore();
    expect(
      await completeSignIn({ api, store: third }, grant(false, "d3"), null),
    ).toEqual({ needsUnlock: true });
    await unlockWithRecovery(
      { api, store: third },
      recovery.toLowerCase().replaceAll("-", " "),
    );
    expect(await third.get("dataKey")).toBeDefined();
  });

  it("rejects typos before the server and wrong keys with a message", async () => {
    const { api } = fakeApi();
    const store = createMemoryStore();
    await completeSignIn({ api, store }, grant(true), null);
    const recovery = await replaceRecoveryKey({ api, store });
    const other = createMemoryStore();
    await other.set("session", { token: "t", userId: "u", deviceId: "x" });
    const typo = (recovery[0] == "A" ? "B" : "A") + recovery.slice(1);
    await expect(
      unlockWithRecovery({ api, store: other }, typo),
    ).rejects.toBeInstanceOf(RecoveryKeyError);
    const otherAccount = await replaceRecoveryKey({
      api: fakeApi().api,
      store,
    });
    await expect(
      unlockWithRecovery({ api, store: other }, otherAccount),
    ).rejects.toThrow("passt nicht");
  });

  it("keeps exactly one recovery wrap", async () => {
    const { api, keys } = fakeApi();
    const store = createMemoryStore();
    await completeSignIn({ api, store }, grant(true), null);
    await replaceRecoveryKey({ api, store });
    await replaceRecoveryKey({ api, store });
    expect([...keys.values()].filter((w) => w.kind == "recovery")).toHaveLength(
      1,
    );
  });

  it("unlocks with a passkey added later and refuses unknown ones", async () => {
    const { api } = fakeApi();
    const store = createMemoryStore();
    await completeSignIn({ api, store }, grant(true), null);
    const later = { credentialId: "later", prfOutput: randomBytes(32) };
    await addPasskeyWrap({ api, store }, later);
    const other = createMemoryStore();
    await completeSignIn({ api, store: other }, grant(false), null);
    await expect(
      unlockWithPrf({ api, store: other }, { ...later, credentialId: "x" }),
    ).rejects.toThrow("Passkey");
    await unlockWithPrf({ api, store: other }, later);
    expect(await other.get("dataKey")).toBeDefined();
  });

  it("ignores a stored key of another account", async () => {
    const { api } = fakeApi();
    const store = createMemoryStore();
    await completeSignIn({ api, store }, grant(true), null);
    const otherUser = { ...grant(false), userId: "v" };
    expect(await completeSignIn({ api, store }, otherUser, null)).toEqual({
      needsUnlock: true,
    });
  });

  it("signs out but keeps the data key", async () => {
    const { api, loggedOut } = fakeApi();
    const store = createMemoryStore();
    await completeSignIn({ api, store }, grant(true), null);
    await signOut({ api, store });
    expect(loggedOut()).toBe(true);
    expect(await store.get("session")).toBeUndefined();
    expect(await store.get("dataKey")).toBeDefined();
  });
});

describe("oidc", () => {
  it("runs PKCE with state across the redirect", async () => {
    const { api } = fakeApi();
    const storage = memoryStorage();
    const target = new URL(
      await beginOidcLogin(api, "google", "iPad", storage, "/#/settings"),
    );
    expect(target.origin + target.pathname).toBe(
      "https://login.test/authorize",
    );
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.get("redirect_uri")).toBe(
      "https://app.test/?oidc=callback",
    );
    const state = target.searchParams.get("state")!;

    const back = `https://app.test/?oidc=callback&code=abc&state=${state}#/`;
    const callback = parseOidcCallback(back)!;
    const { grant: result, returnTo } = await finishOidcLogin(
      api,
      callback,
      storage,
    );
    const body = (result as unknown as { body: Record<string, string> }).body;
    expect(body.code).toBe("abc");
    expect(body.deviceName).toBe("iPad");
    expect(body.codeVerifier).toHaveLength(43);
    expect(returnTo).toBe("/#/settings");
    expect(withoutOidcQuery(back, returnTo)).toBe(
      "https://app.test/#/settings",
    );
    expect(withoutOidcQuery(back)).toBe("https://app.test/#/");
  });

  it("rejects a wrong state and a cancelled login", async () => {
    const { api } = fakeApi();
    const storage = memoryStorage();
    await beginOidcLogin(api, "microsoft", "PC", storage, "/");
    await expect(
      finishOidcLogin(api, { code: "c", state: "wrong", error: null }, storage),
    ).rejects.toThrow("fehlgeschlagen");
    await expect(
      finishOidcLogin(
        api,
        { code: null, state: null, error: "access_denied" },
        storage,
      ),
    ).rejects.toThrow("abgebrochen");
  });

  it("ignores URLs without the callback marker", () => {
    expect(parseOidcCallback("https://app.test/#/?oidc=callback")).toBeNull();
  });
});
