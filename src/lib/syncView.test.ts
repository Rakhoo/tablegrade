import { describe, expect, it } from "vitest";
import { OFF_STATUS } from "../sync/status";
import type { AccountInfo, SyncStatus } from "../sync/types";
import { getSyncBadge, getSyncView } from "./syncView";

/** Status with the given changes on top of the "off" status. */
const status = (change: Partial<SyncStatus>) => ({ ...OFF_STATUS, ...change });

/** Signed-in account with or without a data key on the server. */
const account = (hasDataKey: boolean): AccountInfo => ({
  userId: "u",
  deviceId: "d",
  identities: [],
  hasDataKey,
  hasRecoveryKey: hasDataKey,
  signedInWith: null,
  approved: true,
  contactEmail: null,
  accessNote: null,
  hasPrfPasskey: false,
});

describe("getSyncView", () => {
  it("maps each phase to its view", () => {
    expect(getSyncView(OFF_STATUS)).toBe("off");
    expect(getSyncView(status({ phase: "signedOut" }))).toBe("setup");
    expect(getSyncView(status({ phase: "locked" }))).toBe("missingKey");
    expect(getSyncView(status({ phase: "upgradeRequired" }))).toBe("upgrade");
    expect(getSyncView(status({ phase: "notApproved" }))).toBe("pending");
    for (const phase of ["idle", "syncing", "offline", "error"] as const)
      expect(getSyncView(status({ phase }))).toBe("active");
  });

  it("creates the key for a new account and unlocks an existing one", () => {
    const locked = (hasDataKey: boolean) =>
      status({ phase: "locked", account: account(hasDataKey) });
    expect(getSyncView(locked(false))).toBe("createKey");
    expect(getSyncView(locked(true))).toBe("missingKey");
  });

  it("treats a signed-out device that synced before as an expired sign-in", () => {
    expect(getSyncView(status({ phase: "signedOut", lastSyncAt: 1 }))).toBe(
      "expired",
    );
  });
});

describe("getSyncBadge", () => {
  it("shows nothing while sync is off", () => {
    expect(getSyncBadge(OFF_STATUS)).toBeNull();
  });

  it("maps the phases of an active sync", () => {
    expect(getSyncBadge(status({ phase: "idle" }))?.tone).toBe("ok");
    expect(getSyncBadge(status({ phase: "syncing" }))?.tone).toBe("busy");
    expect(getSyncBadge(status({ phase: "offline" }))?.tone).toBe("warning");
    expect(getSyncBadge(status({ phase: "error" }))?.tone).toBe("error");
  });

  it("asks for attention when the device cannot sync", () => {
    const expired = status({ phase: "signedOut", lastSyncAt: 1 });
    expect(getSyncBadge(expired)?.label).toBe("Abgemeldet");
    expect(getSyncBadge(status({ phase: "locked" }))?.label).toBe(
      "Schlüssel fehlt",
    );
    expect(getSyncBadge(status({ phase: "upgradeRequired" }))?.tone).toBe(
      "error",
    );
  });
});
