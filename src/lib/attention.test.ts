import { describe, expect, it } from "vitest";
import { OFF_STATUS } from "../sync/status";
import type { SyncStatus } from "../sync/types";
import { getAttention, worstTone } from "./attention";

/** Inputs with nothing to do: a school year, sync off. */
const FINE = { sync: OFF_STATUS, schoolYearCount: 1 };

describe("attention", () => {
  it("has nothing to say when everything is set up", () => {
    expect(getAttention(FINE)).toEqual([]);
    expect(worstTone([])).toBeNull();
  });

  it("asks for a school year", () => {
    const items = getAttention({ ...FINE, schoolYearCount: 0 });
    expect(items.map((item) => item.tab)).toEqual(["school"]);
    expect(worstTone(items)).toBe("warning");
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
