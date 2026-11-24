import { describe, expect, it } from "vitest";
import { OFF_STATUS } from "../sync/status";
import type { SyncStatus } from "../sync/types";
import { getAttention, isBackupDue, worstTone } from "./attention";

/** Inputs with nothing to do: a school year, a fresh backup, sync off. */
const FINE = {
  sync: OFF_STATUS,
  backupReminderDays: 14,
  lastBackup: "2026-11-20",
  schoolYearCount: 1,
  now: new Date("2026-11-24"),
};

describe("attention", () => {
  it("has nothing to say when everything is set up", () => {
    expect(getAttention(FINE)).toEqual([]);
    expect(worstTone([])).toBeNull();
  });

  it("asks for a school year and a backup", () => {
    const items = getAttention({
      ...FINE,
      schoolYearCount: 0,
      lastBackup: null,
    });
    expect(items.map((item) => item.tab)).toEqual(["school", "data"]);
    expect(items[1].label).toBe("Noch keine Sicherung");
    expect(worstTone(items)).toBe("warning");
  });

  it("counts the backup as due once it is older than set, never when turned off", () => {
    const now = new Date("2026-11-24");
    expect(isBackupDue(14, "2026-11-10", now)).toBe(true);
    expect(isBackupDue(14, "2026-11-11", now)).toBe(false);
    expect(isBackupDue(0, null, now)).toBe(false);
  });

  it("points to sync while its setup is open or it failed, not while offline", () => {
    const sync = (change: Partial<SyncStatus>) =>
      getAttention({ ...FINE, sync: { ...OFF_STATUS, ...change } });
    expect(sync({ phase: "setupIncomplete" })).toMatchObject([
      { tab: "sync", tone: "warning" },
    ]);
    expect(sync({ phase: "error" })).toMatchObject([{ tone: "error" }]);
    expect(worstTone(sync({ phase: "error" }))).toBe("error");
    expect(sync({ phase: "offline" })).toEqual([]);
    expect(sync({ phase: "idle" })).toEqual([]);
  });
});
