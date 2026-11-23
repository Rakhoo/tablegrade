import { describe, expect, it } from "vitest";
import {
  isGroupCorrect,
  pickCheckGroups,
  recoveryKeyGroups,
} from "./recoveryKeyCheck";

const KEY = "AMZ7-1YWK-S1GM-ZYJY-RV3Z-HHN4-5JVH-1PFY-AS31";

describe("pickCheckGroups", () => {
  it("picks two different groups in ascending order", () => {
    expect(pickCheckGroups(KEY, () => 0)).toEqual([0, 1]);
    expect(pickCheckGroups(KEY, () => 0.99)).toEqual([7, 8]);
    for (let run = 0; run < 50; run++) {
      const [first, second] = pickCheckGroups(KEY);
      expect(first).toBeLessThan(second);
      expect(second).toBeLessThan(recoveryKeyGroups(KEY).length);
    }
  });
});

describe("isGroupCorrect", () => {
  it("accepts case, spaces and look-alike characters", () => {
    expect(isGroupCorrect(KEY, 1, "1YWK")).toBe(true);
    expect(isGroupCorrect(KEY, 1, " lywk ")).toBe(true);
    expect(isGroupCorrect(KEY, 8, "as3i")).toBe(true);
  });

  it("rejects other groups and typos", () => {
    expect(isGroupCorrect(KEY, 0, "1YWK")).toBe(false);
    expect(isGroupCorrect(KEY, 1, "1YW")).toBe(false);
    expect(isGroupCorrect(KEY, 1, "")).toBe(false);
  });
});
