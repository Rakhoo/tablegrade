/**
 * Sync runs (plan B5): applies waiting records, pushes, pulls, and recovers from `410 gone`
 * and `410 server_restored`.
 * The engine runs one sync at a time and reacts to WebSocket messages.
 */
import { recordId } from "../crypto/records";
import { enqueueAllRows } from "./activation";
import { ApiError } from "./api";
import type { SyncContext } from "./context";
import { applyPending, pullChanges } from "./pull";
import { pushChanges } from "./push";
import { classifyError, sessionStatus } from "./session";
import { openSocket, type SocketLike, type SocketMessage } from "./socket";
import { writeSyncState } from "./syncState";
import { isSyncedKey, recordChange, SYNCED_TABLES } from "./tables";
import type { SyncStatus } from "./types";

/** Progress callback: records done and in total. */
export type ProgressHandler = (done: number, total: number) => void;

/** Result of one sync run. */
export type SyncRun = {
  /** Records written into the app tables; the UI reloads its data when > 0. */
  applied: number;
  /** Records waiting for an app update. */
  deferred: number;
};

/** Number of entries in the outbox. */
async function countOutbox(ctx: SyncContext): Promise<number> {
  const [{ count }] = await ctx.db.all<{ count: number }>(
    "SELECT COUNT(*) AS count FROM _outbox",
  );
  return count;
}

/** Queues every local row whose record the server does not know, so nothing gets lost. */
async function requeueUnknownRows(ctx: SyncContext, known: Set<string>) {
  for (const [table, pk] of Object.entries(SYNCED_TABLES)) {
    const rows = await ctx.db.all(`SELECT ${pk.join(", ")} FROM ${table}`);
    for (const row of rows) {
      const values = pk.map((column) => row[column] as string | number);
      if (!isSyncedKey(table, values)) continue;
      if (!known.has(await recordId(ctx.key, table, values)))
        await recordChange(ctx.db, table, values);
    }
  }
}

/**
 * Full download after `410 gone`. Unpushed changes are already sent; rows the server has
 * forgotten (expired deletions) are uploaded again instead of being lost.
 */
async function resync(ctx: SyncContext, onProgress?: ProgressHandler) {
  await writeSyncState(ctx.db, { lastSeq: "0" });
  const outcome = await pullChanges(ctx, onProgress);
  await requeueUnknownRows(ctx, new Set(outcome.ids));
  await pushChanges(ctx);
  return outcome;
}

/**
 * Recovery after `410 server_restored`: the device wins. It uploads all its synced rows again,
 * like on activation, and then fetches everything (protocol.md 4).
 */
async function reupload(ctx: SyncContext, onProgress?: ProgressHandler) {
  await enqueueAllRows(ctx.db);
  await pushChanges(ctx);
  await writeSyncState(ctx.db, { lastSeq: "0" });
  return pullChanges(ctx, onProgress);
}

/** One sync run: waiting records, push, pull. Throws `ApiError` on server problems. */
export async function runSync(
  ctx: SyncContext,
  onProgress?: ProgressHandler,
): Promise<SyncRun> {
  const pendingApplied = await applyPending(ctx);
  const total = await countOutbox(ctx);
  await pushChanges(ctx, (sent) => onProgress?.(Math.min(sent, total), total));
  let outcome;
  try {
    outcome = await pullChanges(ctx, onProgress);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code == "gone") outcome = await resync(ctx, onProgress);
    else if (error.code == "server_restored")
      outcome = await reupload(ctx, onProgress);
    else throw error;
  }
  return {
    applied: pendingApplied + outcome.applied,
    deferred: outcome.deferred,
  };
}

/** Status after a failed run; unexpected errors (e.g. a broken record) become `error`. */
function errorStatus(error: unknown): Partial<SyncStatus> {
  if (error instanceof ApiError) return sessionStatus(classifyError(error));
  console.error(error);
  return { phase: "error", error: "Die Synchronisierung ist fehlgeschlagen." };
}

/** Dependencies of the engine; the facade passes the real ones. */
export type EngineOptions = {
  /** Context of an unlocked, signed-in device, or `null` if sync cannot run now. */
  getContext: () => Promise<SyncContext | null>;
  /** WebSocket URL with the session token, or `null` without a session. */
  socketUrl: () => string | null;
  /** Receives status changes. */
  onStatus: (change: Partial<SyncStatus>) => void;
  /** Called after a run wrote pulled data, so the UI reloads (`useRevalidator`). */
  onApplied: () => void;
  /** Called when the server reports a finished device link. */
  onLink?: (linkId: string) => void;
  /** Creates the WebSocket; tests pass a fake. */
  createSocket?: (url: string) => SocketLike;
};

/** Creates the engine. It does nothing until `start` or `requestSync`. */
export function createSyncEngine(options: EngineOptions) {
  let running: Promise<void> | null = null;
  let again = false;
  let deviceId: string | null = null;
  let closeSocket: (() => void) | null = null;

  /** Runs syncs until no new request came in meanwhile. */
  async function loop() {
    do {
      again = false;
      const ctx = await options.getContext();
      if (!ctx) return;
      deviceId = ctx.deviceId;
      options.onStatus({ phase: "syncing", error: null });
      try {
        const run = await runSync(ctx, (done, total) =>
          options.onStatus({ progress: { done, total } }),
        );
        options.onStatus({
          phase: run.deferred ? "upgradeRequired" : "idle",
          lastSyncAt: Date.now(),
          pending: await countOutbox(ctx),
          progress: null,
        });
        if (run.applied) options.onApplied();
      } catch (error) {
        options.onStatus({ ...errorStatus(error), progress: null });
        return;
      }
    } while (again);
  }

  /** Starts a run, or marks that one more run is needed after the current one. */
  function requestSync(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = loop().finally(() => {
      running = null;
    });
    return running;
  }

  /** Reacts to a server message. */
  function handle(message: SocketMessage) {
    switch (message.type) {
      case "hello":
        void requestSync();
        break;
      case "changed":
        if (message.deviceId != deviceId) void requestSync();
        break;
      case "revoked":
        stop();
        options.onStatus(
          sessionStatus(classifyError(new ApiError("session_revoked", 401))),
        );
        break;
      case "link":
        options.onLink?.(message.linkId);
        break;
    }
  }

  /** Opens the WebSocket; its `hello` starts the first run. */
  function start() {
    closeSocket ??= openSocket(options.socketUrl, handle, options.createSocket);
  }

  /** Closes the WebSocket; a running sync finishes. */
  function stop() {
    closeSocket?.();
    closeSocket = null;
  }

  return { requestSync, start, stop };
}

/** The engine type, for the facade. */
export type SyncEngine = ReturnType<typeof createSyncEngine>;
