import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyBackup,
  BackupError,
  backupFileName,
  downloadBackup,
  parseBackup,
  type Backup,
} from "@/lib/backup";
import { getRawData, saveRoutine } from "@/lib/storage";
import { LOCALE_KEY } from "@/lib/storage-keys";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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
        routines: [
          {
            id: "r1",
            name: "A",
            order: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            steps: [],
          },
        ],
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
          {
            id: "r1",
            name: "Good",
            order: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            steps: [],
          },
          { id: "r2" },
        ],
      },
    });
    const result = parseBackup(text);
    expect(result.data.routines).toEqual([
      {
        id: "r1",
        name: "Good",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      },
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
        routines: [
          {
            id: "r1",
            name: "A",
            order: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            steps: [],
          },
        ],
        state: {},
      },
    });
    expect(getRawData().routines).toEqual([
      {
        id: "r1",
        name: "A",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      },
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

describe("downloadBackup", () => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL at all, so
  // calling downloadBackup unstubbed throws — spy on just those two methods
  // rather than replacing the whole URL global (still a real constructor
  // for everything else).
  function stubObjectUrl(url: string) {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue(url);
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    return { createObjectURL, revokeObjectURL };
  }

  const backup: Backup = {
    app: "routines",
    version: 1,
    exportedAt: "2026-09-17T12:00:00.000Z",
    locale: null,
    data: { routines: [], state: {} },
  };

  it("creates a download link for the backup and clicks it", () => {
    const { createObjectURL } = stubObjectUrl("blob:mock-url");
    let capturedHref = "";
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedHref = this.href;
      capturedDownload = this.download;
    });

    downloadBackup(backup);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedHref).toBe("blob:mock-url");
    expect(capturedDownload).toBe("routines-backup-2026-09-17.json");
  });

  it("revokes the object URL after a delay, not immediately", () => {
    vi.useFakeTimers();
    const { revokeObjectURL } = stubObjectUrl("blob:mock-url");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBackup(backup);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("defaults to a fresh createBackup() snapshot when none is given", () => {
    saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    stubObjectUrl("blob:mock-url");
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedDownload = this.download;
    });

    downloadBackup();

    // No explicit backup passed — falls back to createBackup(), whose
    // exportedAt is "now", so just check the filename reflects today.
    const today = backupFileName();
    expect(capturedDownload).toBe(today);
  });
});
