import { beforeEach, describe, expect, it } from "vitest";

import {
  applyBackup,
  BackupError,
  backupFileName,
  parseBackup,
} from "@/lib/backup";
import { getRawData } from "@/lib/storage";
import { LOCALE_KEY } from "@/lib/storage-keys";

beforeEach(() => {
  localStorage.clear();
});

describe("parseBackup", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseBackup("{not json")).toThrow(BackupError);
    expect(() => parseBackup("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects a file that isn't a Routines backup", () => {
    expect(() => parseBackup(JSON.stringify({ app: "other" }))).toThrow(
      /not a Routines backup/,
    );
    expect(() => parseBackup(JSON.stringify({}))).toThrow(
      /not a Routines backup/,
    );
  });

  it("rejects a mismatched version", () => {
    const text = JSON.stringify({ app: "routines", version: 999 });
    expect(() => parseBackup(text)).toThrow(/different app version/);
  });

  it("rejects a backup with no routines array", () => {
    const text = JSON.stringify({ app: "routines", version: 1, data: {} });
    expect(() => parseBackup(text)).toThrow(/does not contain any routines/);
  });

  it("round-trips a fully valid backup", () => {
    const backup = {
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: "pl",
      data: {
        routines: [{ id: "r1", name: "A", order: 0, steps: [] }],
        state: { r1: { checkedStepIds: [], lastResetDate: "2026-09-17" } },
      },
    };
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it("falls back to sane defaults for a non-string exportedAt/locale", () => {
    const text = JSON.stringify({
      app: "routines",
      version: 1,
      exportedAt: 12345,
      locale: 42,
      data: { routines: [] },
    });
    const result = parseBackup(text);
    expect(typeof result.exportedAt).toBe("string");
    expect(() => new Date(result.exportedAt).toISOString()).not.toThrow();
    expect(result.locale).toBeNull();
  });

  it("drops one bad routine instead of rejecting the whole import", () => {
    const text = JSON.stringify({
      app: "routines",
      version: 1,
      data: {
        routines: [
          { id: "r1", name: "Good", order: 0, steps: [] },
          { id: "r2" },
        ],
      },
    });
    const result = parseBackup(text);
    expect(result.data.routines).toEqual([
      { id: "r1", name: "Good", order: 0, steps: [] },
    ]);
  });
});

describe("applyBackup", () => {
  it("writes the backup's data via replaceAllData", () => {
    applyBackup({
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: null,
      data: {
        routines: [{ id: "r1", name: "A", order: 0, steps: [] }],
        state: {},
      },
    });
    expect(getRawData().routines).toEqual([
      { id: "r1", name: "A", order: 0, steps: [] },
    ]);
  });

  it("updates the locale when the backup has a valid one", () => {
    applyBackup({
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: "pl",
      data: { routines: [], state: {} },
    });
    expect(localStorage.getItem(LOCALE_KEY)).toBe("pl");
  });

  it("leaves the current locale untouched for an invalid/null locale", () => {
    localStorage.setItem(LOCALE_KEY, "en");
    applyBackup({
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: null,
      data: { routines: [], state: {} },
    });
    expect(localStorage.getItem(LOCALE_KEY)).toBe("en");
  });
});

describe("backupFileName", () => {
  it("formats a date as routines-backup-YYYY-MM-DD.json", () => {
    expect(backupFileName(new Date(2026, 8, 17))).toBe(
      "routines-backup-2026-09-17.json",
    );
  });

  it("zero-pads single-digit month and day", () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe(
      "routines-backup-2026-01-05.json",
    );
  });
});
