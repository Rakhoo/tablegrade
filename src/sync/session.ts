/**
 * Session check: at start, every 15 minutes, when the device comes online and when
 * the app becomes visible. A revoked session only stops sync; local work goes on.
 */
import { ApiError, type Api, type KeyWrap, type SessionInfo } from "./api";
import type { AccountInfo, SyncStatus } from "./types";

/** Interval of the periodic check. */
export const SESSION_CHECK_INTERVAL = 15 * 60_000;

/** Outcome of one session check. */
export type SessionCheck =
  | { state: "valid"; info: SessionInfo; keys: KeyWrap[] }
  /** The device was revoked; sync stops until a new sign-in. */
  | { state: "revoked"; message: string }
  /** The session expired or is unknown. */
  | { state: "signedOut"; message: string }
  /** The server needs a newer app version. */
  | { state: "upgradeRequired"; message: string }
  /** The account waits for approval; `info` is missing when a sync call was refused. */
  | { state: "notApproved"; info?: SessionInfo }
  /** The server is not reachable; keep the last known state. */
  | { state: "offline" }
  | { state: "error"; message: string };

/** Asks the server whether the session is still valid. */
export async function checkSession(api: Api): Promise<SessionCheck> {
  try {
    const info = await api.session();
    // Keys are refused before approval, so they are only asked for afterwards
    if (!info.approved) return { state: "notApproved", info };
    return { state: "valid", info, keys: await api.listKeys() };
  } catch (error) {
    return classifyError(error);
  }
}

/** Classifies a failed server call; also used by the sync run. Rethrows non-API errors. */
export function classifyError(
  error: unknown,
): Exclude<SessionCheck, { state: "valid" }> {
  if (!(error instanceof ApiError)) throw error;
  switch (error.code) {
    case "session_revoked":
      return { state: "revoked", message: error.message };
    case "unauthorized":
      return { state: "signedOut", message: error.message };
    case "upgrade_required":
      return { state: "upgradeRequired", message: error.message };
    case "not_approved":
      return { state: "notApproved" };
    case "offline":
      return { state: "offline" };
    default:
      return { state: "error", message: error.message };
  }
}

/**
 * Account as the UI sees it. A passkey wrap exists only for passkeys with PRF, so it tells
 * whether the device can unlock with a passkey.
 */
export function accountInfo(info: SessionInfo, keys: KeyWrap[]): AccountInfo {
  return {
    userId: info.userId,
    deviceId: info.deviceId,
    identities: info.identities,
    hasDataKey: keys.length > 0,
    hasRecoveryKey: keys.some((wrap) => wrap.kind == "recovery"),
    hasPrfPasskey: keys.some((wrap) => wrap.kind == "passkey"),
    signedInWith: null,
    approved: info.approved,
    contactEmail: info.contactEmail,
    accessNote: info.accessNote,
  };
}

/**
 * Status change for a check result. A revoked or expired session becomes `signedOut` with the
 * reason in `error`, so the UI can show the hint while the app keeps working locally.
 */
export function sessionStatus(check: SessionCheck): Partial<SyncStatus> {
  switch (check.state) {
    case "valid":
      return { account: accountInfo(check.info, check.keys), error: null };
    case "revoked":
    case "signedOut":
      return { phase: "signedOut", account: null, error: check.message };
    case "upgradeRequired":
      return { phase: "upgradeRequired", error: check.message };
    case "notApproved":
      return {
        phase: "notApproved",
        error: null,
        ...(check.info && { account: accountInfo(check.info, []) }),
      };
    case "offline":
      return { phase: "offline" };
    case "error":
      return { phase: "error", error: check.message };
  }
}

/** Event sources of the monitor; the app passes `window` and `document`. */
export type SessionMonitorTargets = {
  /** Fires `online`. */
  window: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  /** Fires `visibilitychange`. */
  document: Pick<
    Document,
    "addEventListener" | "removeEventListener" | "visibilityState"
  >;
};

/**
 * Runs `check` now and on every trigger; overlapping runs are skipped. Returns the function
 * that stops the monitor.
 */
export function startSessionMonitor(
  check: () => Promise<void>,
  targets: SessionMonitorTargets = { window, document },
): () => void {
  let running = false;
  /** Runs the check unless one is still running. */
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await check();
    } finally {
      running = false;
    }
  };
  /** Checks when the app comes to the foreground. */
  const onVisible = () => {
    if (targets.document.visibilityState == "visible") void run();
  };
  const timer = setInterval(run, SESSION_CHECK_INTERVAL);
  targets.window.addEventListener("online", run);
  targets.document.addEventListener("visibilitychange", onVisible);
  void run();
  return () => {
    clearInterval(timer);
    targets.window.removeEventListener("online", run);
    targets.document.removeEventListener("visibilitychange", onVisible);
  };
}
