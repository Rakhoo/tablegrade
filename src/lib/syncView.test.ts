import { describe, expect, it } from "vitest";
import { OFF_STATUS } from "../sync/status";
import type { SyncStatus } from "../sync/types";
import { getSyncView } from "./syncView";

/** Status with the given changes on top of the "off" status. */
const status = (change: Partial<SyncStatus>) => ({ ...OFF_STATUS, ...change });

describe("getSyncView", () => {
  it("maps each phase to its view", () => {
    expect(getSyncView(OFF_STATUS)).toBe("off");
    expect(getSyncView(status({ phase: "signedOut" }))).toBe("setup");
    expect(getSyncView(status({ phase: "locked" }))).toBe("missingKey");
    for (const phase of ["idle", "syncing", "offline", "error"] as const)
      expect(getSyncView(status({ phase }))).toBe("active");
  });

  it("treats a signed-out device that synced before as an expired sign-in", () => {
    expect(getSyncView(status({ phase: "signedOut", lastSyncAt: 1 }))).toBe(
      "expired",
    );
  });
});
