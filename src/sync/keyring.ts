/**
 * Data key handling after sign-in (plan B4): unlock with a passkey PRF output or the recovery
 * key, create and replace the recovery key, add passkey wraps. Device link: see B6.
 */
import { fromBase64url, toBase64url, type Bytes } from "../crypto/encoding";
import {
  generateDataKey,
  passkeyKek,
  recoveryKek,
  unwrapDataKey,
  wrapDataKey,
  type DataKey,
} from "../crypto/keys";
import {
  formatRecoveryKey,
  generateRecoveryBytes,
  parseRecoveryKey,
} from "../crypto/recoveryKey";
import type { Api, KeyWrap, SessionGrant } from "./api";
import type { DeviceStore } from "./deviceStore";

/** What the key functions need. */
export type KeyringContext = { api: Api; store: DeviceStore };

/** A passkey's PRF output together with its credential id. */
export type PrfResult = { credentialId: string; prfOutput: Bytes };

/** Signed-in user; throws if there is no session. */
export async function sessionUser(store: DeviceStore): Promise<string> {
  const session = await store.get("session");
  if (!session) throw new Error("Bitte zuerst anmelden.");
  return session.userId;
}

/** The stored data key if it belongs to `userId`. */
async function ownDataKey(
  store: DeviceStore,
  userId: string,
): Promise<DataKey | null> {
  const stored = await store.get("dataKey");
  return stored?.userId == userId ? stored.key : null;
}

/** Stores the data key for `userId`. */
export function keepDataKey(store: DeviceStore, userId: string, key: DataKey) {
  return store.set("dataKey", { userId, key });
}

/** Builds a new wrap object for upload. */
async function newWrap(
  key: DataKey,
  kek: CryptoKey,
  kind: KeyWrap["kind"],
  userId: string,
  credentialId?: string,
): Promise<KeyWrap> {
  return {
    id: crypto.randomUUID(),
    kind,
    credentialId,
    alg: "A256GCM",
    wrapped: toBase64url(await wrapDataKey(key, kek, kind, userId)),
    createdAt: Date.now(),
  };
}

/**
 * Stores the session of a sign-in and tries to unlock. Returns whether the device still needs
 * the data key. A new account gets a fresh data key here; it is uploaded with the first
 * recovery key and, with PRF, a passkey wrap.
 */
export async function completeSignIn(
  { api, store }: KeyringContext,
  grant: SessionGrant,
  prf: PrfResult | null,
): Promise<{ needsUnlock: boolean }> {
  const { sessionToken: token, userId, deviceId } = grant;
  await store.set("session", { token, userId, deviceId });
  if (await ownDataKey(store, userId)) return { needsUnlock: false };
  if (grant.isNewUser) {
    const key = await generateDataKey();
    await keepDataKey(store, userId, key);
    if (prf) await addPasskeyWrap({ api, store }, prf);
    return { needsUnlock: false };
  }
  if (!prf) return { needsUnlock: true };
  try {
    await unlockWithPrf({ api, store }, prf);
    return { needsUnlock: false };
  } catch {
    return { needsUnlock: true };
  }
}

/** Credential ids of all passkey wraps, for `evaluatePrf`. */
export async function passkeyWrapIds(api: Api): Promise<string[]> {
  return (await api.listKeys())
    .filter((wrap) => wrap.kind == "passkey" && wrap.credentialId)
    .map((wrap) => wrap.credentialId!);
}

/** Unwraps a wrap and stores the key; throws `message` if the KEK does not fit. */
async function unlock(
  store: DeviceStore,
  wrap: KeyWrap | undefined,
  kek: CryptoKey,
  userId: string,
  message: string,
) {
  if (!wrap) throw new Error(message);
  const key = await unwrapDataKey(
    fromBase64url(wrap.wrapped),
    kek,
    wrap.kind,
    userId,
  ).catch(() => {
    throw new Error(message);
  });
  await keepDataKey(store, userId, key);
}

/** Unlocks with the PRF output of a passkey that has a wrap. */
export async function unlockWithPrf(
  { api, store }: KeyringContext,
  { credentialId, prfOutput }: PrfResult,
): Promise<void> {
  const userId = await sessionUser(store);
  const wrap = (await api.listKeys()).find(
    (item) => item.kind == "passkey" && item.credentialId == credentialId,
  );
  await unlock(
    store,
    wrap,
    await passkeyKek(prfOutput),
    userId,
    "Mit diesem Passkey lassen sich die Daten nicht entsperren.",
  );
}

/**
 * Unlocks with the recovery key as typed. Typos fail before any server call with a
 * `RecoveryKeyError`.
 */
export async function unlockWithRecovery(
  { api, store }: KeyringContext,
  text: string,
): Promise<void> {
  const bytes = await parseRecoveryKey(text);
  const userId = await sessionUser(store);
  const wrap = (await api.listKeys()).find((item) => item.kind == "recovery");
  await unlock(
    store,
    wrap,
    await recoveryKek(bytes),
    userId,
    "Der Wiederherstellungsschlüssel passt nicht zu diesem Konto.",
  );
}

/** The unlocked data key of the signed-in account; throws while locked. */
export async function unlockedKey(store: DeviceStore) {
  const userId = await sessionUser(store);
  const key = await ownDataKey(store, userId);
  if (!key) throw new Error("Die Daten sind auf diesem Gerät noch gesperrt.");
  return { userId, key };
}

/**
 * Creates a new recovery key, uploads its wrap and then deletes older recovery wraps (the
 * server keeps at least one). Returns the text to show once.
 */
export async function replaceRecoveryKey({
  api,
  store,
}: KeyringContext): Promise<string> {
  const { userId, key } = await unlockedKey(store);
  const bytes = generateRecoveryBytes();
  const wrap = await newWrap(key, await recoveryKek(bytes), "recovery", userId);
  const old = (await api.listKeys()).filter((item) => item.kind == "recovery");
  await api.putKey(wrap);
  for (const item of old) await api.deleteKey(item.id);
  return formatRecoveryKey(bytes);
}

/** Uploads a wrap for a passkey with PRF, so it can unlock other devices. */
export async function addPasskeyWrap(
  { api, store }: KeyringContext,
  { credentialId, prfOutput }: PrfResult,
): Promise<void> {
  const { userId, key } = await unlockedKey(store);
  await api.putKey(
    await newWrap(
      key,
      await passkeyKek(prfOutput),
      "passkey",
      userId,
      credentialId,
    ),
  );
}

/** Ends the session on the server (if reachable) and here. Data key and data stay. */
export async function signOut({ api, store }: KeyringContext): Promise<void> {
  await api.logout().catch(() => {});
  await store.delete("session");
}
