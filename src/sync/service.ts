/**
 * The sync service behind the facade (plan B6): keeps session, data key, activation and engine
 * in step and turns them into the status for the UI. All browser parts come in as
 * dependencies, so the tests run it in Node.
 */
import { deleteAccount as removeAccount } from "./account";
import { turnOff } from "./activation";
import { activateSync, isActivated } from "./activationFlow";
import type { Api, KeyWrap } from "./api";
import { findLink, startLink, type StartedLink } from "./deviceLink";
import type { DeviceStore } from "./deviceStore";
import { countOutbox, createSyncEngine } from "./engine";
import { checkImportedDatabase } from "./importGuard";
import {
  completeSignIn,
  replaceRecoveryKey,
  signOut,
  unlockWithRecovery,
  type KeyringContext,
} from "./keyring";
import {
  beginOidcLogin,
  finishOidcLogin,
  parseOidcCallback,
  withoutOidcQuery,
} from "./oidc";
import { addPasskey, unlockWithPasskey } from "./passkeyFlow";
import {
  checkSession,
  sessionStatus,
  startSessionMonitor,
  type SessionCheck,
  type SessionMonitorTargets,
} from "./session";
import type { SocketLike } from "./socket";
import { OFF_STATUS, readStatus, updateStatus } from "./status";
import type { SyncDb } from "./syncDb";
import type {
  DeviceLinkApproval,
  OidcProvider,
  PendingDeviceLink,
} from "./types";

/** Interval of the outbox check that sends local changes. */
export const LOCAL_CHANGE_INTERVAL = 5000;

/** Device store entries that `disableSync` removes besides the session; the data key stays. */
const OFF_KEYS = ["wanted", "syncId", "syncUserId", "importNotice"] as const;

/** Browser parts of the service. */
export type ServiceDeps = {
  /** App database. */
  db: SyncDb;
  /** Device store (IndexedDB). */
  store: DeviceStore;
  /** Creates the API client; `getToken` returns the current session token. */
  createApi: (getToken: () => string | null) => Api;
  /** Storage that survives the OIDC redirect (`localStorage`). */
  storage: Storage;
  /** Current page URL. */
  currentUrl: () => string;
  /** Leaves the app for the OIDC provider. */
  navigate: (url: string) => void;
  /** Replaces the URL without reloading, to remove the OIDC query. */
  replaceUrl: (url: string) => void;
  /** Event sources of the session check; `undefined` in tests. */
  monitorTargets?: SessionMonitorTargets;
  /** Creates the WebSocket; tests pass a fake. */
  createSocket?: (url: string) => SocketLike;
};

/** Creates the service. Nothing runs before `start`. */
export function createSyncService(deps: ServiceDeps) {
  const { db, store } = deps;
  let token: string | null = null;
  const api = deps.createApi(() => token);
  const keyring: KeyringContext = { api, store };
  const appliedListeners = new Set<() => void>();
  let link: StartedLink | null = null;
  let stopMonitor: (() => void) | null = null;
  let localTimer: ReturnType<typeof setInterval> | null = null;

  /** Sign-in data of this device if it is unlocked and sync is active. */
  async function readyContext() {
    const session = await store.get("session");
    const dataKey = await store.get("dataKey");
    if (!session || dataKey?.userId != session.userId) return null;
    if (!(await isActivated(db, store, session.userId))) return null;
    return { db, api, key: dataKey.key, ...session };
  }

  /** Forgets a session the server no longer accepts. */
  async function dropSession() {
    engine.stop();
    token = null;
    await store.delete("session");
  }

  const engine = createSyncEngine({
    getContext: readyContext,
    socketUrl: () => (token ? api.socketUrl(token) : null),
    onStatus: (change) => {
      updateStatus(change);
      if (change.phase == "signedOut") void dropSession();
    },
    onApplied: () => appliedListeners.forEach((listener) => listener()),
    onLink: (linkId) => {
      if (link?.linkId == linkId) link.notify();
    },
    createSocket: deps.createSocket,
  });

  /**
   * Brings the status in line with the stored state and starts the engine when the device is
   * ready. `check` reuses a session check that just ran.
   */
  async function refresh(check?: SessionCheck): Promise<void> {
    if (!(await store.get("wanted"))) {
      engine.stop();
      const { error, importNotice } = readStatus();
      updateStatus({ ...OFF_STATUS, error, importNotice });
      return;
    }
    const session = await store.get("session");
    token = session?.token ?? null;
    if (!session) {
      engine.stop();
      updateStatus({ phase: "signedOut", account: null, progress: null });
      return;
    }
    check ??= await checkSession(api);
    const change = sessionStatus(check);
    if (change.account)
      change.account.signedInWith = session.signedInWith ?? null;
    updateStatus(change);
    if (check.state == "revoked" || check.state == "signedOut")
      return dropSession();
    if (check.state == "upgradeRequired" || check.state == "notApproved")
      return engine.stop();
    const dataKey = await store.get("dataKey");
    if (dataKey?.userId != session.userId) {
      updateStatus({ phase: "locked" });
      return;
    }
    if (!(await isActivated(db, store, session.userId))) {
      if (check.state != "valid") return;
      // Unlocked but not syncing yet: the recovery key or the consent to replace local data
      // is missing, so the status must not look like a working sync
      if (!(await activate(check.keys, false))) {
        updateStatus({ phase: "setupIncomplete", progress: null });
        return;
      }
    }
    engine.start();
    void engine.requestSync();
  }

  /** Activates sync for the signed-in account; see `activateSync`. */
  async function activate(keys: KeyWrap[], replace: boolean) {
    const session = await store.get("session");
    if (!session) return false;
    return activateSync({ db, store, api }, session.userId, keys, replace);
  }

  /** Finishes an OIDC login or identity link when the provider redirects back. */
  async function handleOidcReturn() {
    const href = deps.currentUrl();
    const callback = parseOidcCallback(href);
    if (!callback) return;
    try {
      const { grant, provider, returnTo } = await finishOidcLogin(
        api,
        callback,
        deps.storage,
      );
      deps.replaceUrl(withoutOidcQuery(href, returnTo));
      if (grant)
        await completeSignIn(keyring, grant, {
          provider,
          email: grant.email ?? null,
        });
    } catch (error) {
      deps.replaceUrl(withoutOidcQuery(href));
      updateStatus({ error: (error as Error).message });
    }
  }

  /** Sends local changes soon after they were written; the triggers fill the outbox. */
  async function checkLocalChanges() {
    if (readStatus().phase != "idle" || !(await readyContext())) return;
    const pending = await countOutbox(db);
    if (pending) void engine.requestSync();
  }

  /** Removes the hint about an imported backup from store and status. */
  async function clearImportNotice() {
    await store.delete("importNotice");
    updateStatus({ importNotice: false });
  }

  /** Starts the OIDC redirect; with a session the server links the identity instead. */
  async function redirectToProvider(
    provider: OidcProvider,
    deviceName: string,
  ) {
    const url = new URL(deps.currentUrl());
    const returnTo = url.pathname + url.hash;
    deps.navigate(
      await beginOidcLogin(api, provider, deviceName, deps.storage, returnTo),
    );
  }

  return {
    /** Checks for an imported backup, finishes an OIDC return and starts the checks. */
    async start() {
      if (stopMonitor) return;
      // The guard sets `importNotice` when an imported backup turned sync off; it stays
      // until the user dismisses it or turns sync on again
      await checkImportedDatabase(db, store);
      if (await store.get("importNotice")) {
        await store.delete("wanted");
        updateStatus({ importNotice: true });
      }
      await handleOidcReturn();
      // The monitor runs a check right away, which also starts the engine
      stopMonitor = startSessionMonitor(() => refresh(), deps.monitorTargets);
      localTimer = setInterval(checkLocalChanges, LOCAL_CHANGE_INTERVAL);
    },
    /** Stops engine and checks; only for tests. */
    stop() {
      engine.stop();
      stopMonitor?.();
      stopMonitor = null;
      if (localTimer) clearInterval(localTimer);
    },
    async enableSync() {
      await clearImportNotice();
      await store.set("wanted", true);
      updateStatus({ error: null });
      await refresh();
    },
    async disableSync() {
      engine.stop();
      await signOut(keyring);
      token = null;
      await turnOff(db);
      for (const key of OFF_KEYS) await store.delete(key);
      updateStatus(OFF_STATUS);
    },
    startOidcLogin: redirectToProvider,
    async addPasskey() {
      const canUnlock = await addPasskey(keyring);
      await refresh();
      if (!canUnlock)
        throw new Error(
          "Dieser Passkey kann die Daten nicht entsperren. Bitte einen anderen Speicherort wählen, z. B. iCloud-Schlüsselbund oder Google Passwortmanager.",
        );
    },
    async unlockWithPasskey() {
      await unlockWithPasskey(keyring);
      await refresh();
    },
    async unlockWithRecoveryKey(text: string) {
      await unlockWithRecovery(keyring, text);
      await refresh();
    },
    async createRecoveryKey() {
      const text = await replaceRecoveryKey(keyring);
      await refresh();
      return text;
    },
    async startDeviceLink(): Promise<PendingDeviceLink> {
      link?.cancel();
      const started = await startLink(keyring);
      link = started;
      return {
        ...started,
        accept: async () => {
          await started.accept();
          link = null;
          await refresh();
        },
        cancel: () => {
          started.cancel();
          link = null;
        },
      };
    },
    confirmDeviceLink: (code: string): Promise<DeviceLinkApproval> =>
      findLink(keyring, code),
    listDevices: () => api.listDevices(),
    renameDevice: (id: string, name: string) => api.renameDevice(id, name),
    async setContact(email: string, note: string) {
      await api.putContact(email, note);
      await refresh();
    },
    revokeDevice: (id: string) => api.revokeDevice(id),
    async replaceLocalData() {
      engine.stop();
      await activate(await api.listKeys(), true);
      await refresh();
    },
    async syncNow() {
      if (!(await readyContext())) return refresh();
      await engine.requestSync();
    },
    async logout() {
      engine.stop();
      await signOut(keyring);
      token = null;
      updateStatus({ phase: "signedOut", account: null, error: null });
    },
    async deleteAccount() {
      engine.stop();
      await removeAccount(keyring, db);
      token = null;
      updateStatus(OFF_STATUS);
    },
    dismissImportNotice: clearImportNotice,
    /** Calls `listener` after pulled data was written, so the UI reloads. */
    subscribeApplied(listener: () => void) {
      appliedListeners.add(listener);
      return () => {
        appliedListeners.delete(listener);
      };
    },
  };
}

/** The service type, for the facade. */
export type SyncService = ReturnType<typeof createSyncService>;
