import { describe, expect, it } from "vitest";
import { BASELINE_VERSION } from "../db/migrations";
import { LATEST_VERSION, migrateTo, openTestDb, userVersion } from "./sqliteDb";

describe("openTestDb", () => {
  it("creates the current schema version", () => {
    const db = openTestDb();
    expect(userVersion(db)).toBe(LATEST_VERSION);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(
      expect.arrayContaining(["Classes", "Students", "Duties"]),
    );
  });

  it("migrates a baseline database step by step", () => {
    const db = openTestDb(BASELINE_VERSION);
    expect(userVersion(db)).toBe(BASELINE_VERSION);
    migrateTo(db);
    expect(userVersion(db)).toBe(LATEST_VERSION);
  });
});
