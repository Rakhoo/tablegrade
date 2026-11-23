/**
 * Device-bound sync data in IndexedDB: data key, session and the id of the current sync
 * activation. These are secrets or belong to this device only, so they live outside the
 * SQLite file and never end up in a backup export.
 */
import type { DataKey } from "../crypto/keys";

/** The session of this device (protocol.md section 2). */
export type StoredSession = {
  /** Bearer token, Base64url. */
  token: string;
  /** Server user id (UUID). */
  userId: string;
  /** Server device id (UUID). */
  deviceId: string;
};

/** The data key together with the account it belongs to. */
export type StoredDataKey = {
  /** Account of the key; a key of another account is never used. */
  userId: string;
  /** DEK and IDK as non-serialized `CryptoKey`s. */
  key: DataKey;
};

/** Values in the device store by key. */
export type DeviceValues = {
  /** Data key; stays after logout so the next sign-in to the same account needs no unlock. */
  dataKey: StoredDataKey;
  /** Session; missing while signed out. */
  session: StoredSession;
  /** Random id of the current sync activation; must match `_sync_state.syncId`. */
  syncId: string;
  /** Set when an imported backup turned sync off; the UI shows a hint once. */
  importNotice: true;
};

/** Key-value access to the device store; IndexedDB in the app, memory in tests. */
export type DeviceStore = {
  /** Reads a value; `undefined` if missing. */
  get<K extends keyof DeviceValues>(
    key: K,
  ): Promise<DeviceValues[K] | undefined>;
  /** Writes a value. */
  set<K extends keyof DeviceValues>(
    key: K,
    value: DeviceValues[K],
  ): Promise<void>;
  /** Removes a value. */
  delete(key: keyof DeviceValues): Promise<void>;
  /** Removes all values, e.g. after deleting the account. */
  clear(): Promise<void>;
};

const DB_NAME = "notenfeder-sync";
const STORE_NAME = "device";

/** Wraps an `IDBRequest` in a promise. */
function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Opens the IndexedDB database, creating the object store on first use. */
function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
  return done(request);
}

/** Device store backed by IndexedDB; the connection opens on first use. */
export function createIndexedDbStore(): DeviceStore {
  let database: Promise<IDBDatabase> | undefined;
  /** Runs one request on the object store. */
  async function request<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    database ??= openDatabase();
    const store = (await database)
      .transaction(STORE_NAME, mode)
      .objectStore(STORE_NAME);
    return done(action(store));
  }
  return {
    get: (key) => request("readonly", (store) => store.get(key)),
    set: async (key, value) => {
      await request("readwrite", (store) => store.put(value, key));
    },
    delete: (key) => request("readwrite", (store) => store.delete(key)),
    clear: () => request("readwrite", (store) => store.clear()),
  };
}

/** Device store in memory, for tests. */
export function createMemoryStore(): DeviceStore {
  const values = new Map<string, unknown>();
  return {
    get: async (key) => values.get(key) as never,
    set: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
    clear: async () => values.clear(),
  };
}
