import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// backup.ts itself holds no module-level state, but it calls into
// storage.ts and locale-store.ts, which now cache data in memory after an
// async load from IndexedDB — a fresh module instance per test (awaiting
// storage's `whenLoaded()`) keeps one test's data from bleeding into the
// next, same reasoning as storage.test.ts.
async function freshBackup() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  const localeStore = await import("@/lib/locale-store");
  const backup = await import("@/lib/backup");
  const idbStore = await import("@/lib/idb-store");
  return { storage, localeStore, backup, idbStore };
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("parseBackup", () => {
  it("rejects invalid JSON", async () => {
    const { backup } = await freshBackup();
    expect(() => backup.parseBackup("{not json")).toThrow(backup.BackupError);
    expect(() => backup.parseBackup("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects a file that isn't a Routines backup", async () => {
    const { backup } = await freshBackup();
    expect(() => backup.parseBackup(JSON.stringify({ app: "other" }))).toThrow(
      /not a Routines backup/,
    );
    expect(() => backup.parseBackup(JSON.stringify({}))).toThrow(
      /not a Routines backup/,
    );
  });

  it("rejects a mismatched version", async () => {
    const { backup } = await freshBackup();
    const text = JSON.stringify({ app: "routines", version: 999 });
    expect(() => backup.parseBackup(text)).toThrow(/different app version/);
  });

  it("rejects a backup with no routines array", async () => {
    const { backup } = await freshBackup();
    const text = JSON.stringify({ app: "routines", version: 1, data: {} });
    expect(() => backup.parseBackup(text)).toThrow(
      /does not contain any routines/,
    );
  });

  it("round-trips a fully valid backup", async () => {
    const { backup } = await freshBackup();
    const value = {
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
    expect(backup.parseBackup(JSON.stringify(value))).toEqual(value);
  });

  it("falls back to sane defaults for a non-string exportedAt/locale", async () => {
    const { backup } = await freshBackup();
    const text = JSON.stringify({
      app: "routines",
      version: 1,
      exportedAt: 12345,
      locale: 42,
      data: { routines: [] },
    });
    const result = backup.parseBackup(text);
    expect(typeof result.exportedAt).toBe("string");
    expect(() => new Date(result.exportedAt).toISOString()).not.toThrow();
    expect(result.locale).toBeNull();
  });

  it("drops one bad routine instead of rejecting the whole import", async () => {
    const { backup } = await freshBackup();
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
    const result = backup.parseBackup(text);
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

describe("parseBackupValue", () => {
  it("validates an already-parsed object the same way as parseBackup", async () => {
    const { backup } = await freshBackup();
    const value = {
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: null,
      data: { routines: [], state: {} },
    };
    expect(backup.parseBackupValue(value)).toEqual(value);
    expect(() => backup.parseBackupValue({ app: "other" })).toThrow(
      backup.BackupError,
    );
  });
});

describe("applyBackup", () => {
  it("writes the backup's data via replaceAllData", async () => {
    const { backup, storage } = await freshBackup();
    backup.applyBackup({
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
    expect(storage.getRawData().routines).toEqual([
      {
        id: "r1",
        name: "A",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      },
    ]);
  });

  it("updates the locale when the backup has a valid one", async () => {
    const { backup, idbStore } = await freshBackup();
    backup.applyBackup({
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: "pl",
      data: { routines: [], state: {} },
    });
    await expect(idbStore.kvGet(LOCALE_KEY)).resolves.toBe("pl");
  });

  it("leaves the current locale untouched for an invalid/null locale", async () => {
    const { backup, localeStore, idbStore } = await freshBackup();
    localeStore.setStoredLocale("en");
    backup.applyBackup({
      app: "routines",
      version: 1,
      exportedAt: "2026-09-17T12:00:00.000Z",
      locale: null,
      data: { routines: [], state: {} },
    });
    await expect(idbStore.kvGet(LOCALE_KEY)).resolves.toBe("en");
  });
});

describe("backupFileName", () => {
  it("formats a date as routines-backup-YYYY-MM-DD.txt", async () => {
    const { backup } = await freshBackup();
    expect(backup.backupFileName(new Date(2026, 8, 17))).toBe(
      "routines-backup-2026-09-17.txt",
    );
  });

  it("zero-pads single-digit month and day", async () => {
    const { backup } = await freshBackup();
    expect(backup.backupFileName(new Date(2026, 0, 5))).toBe(
      "routines-backup-2026-01-05.txt",
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

  const backupValue = {
    app: "routines" as const,
    version: 1,
    exportedAt: "2026-09-17T12:00:00.000Z",
    locale: null,
    data: { routines: [], state: {} },
  };

  it("creates a download link for the backup and clicks it", async () => {
    const { backup } = await freshBackup();
    const { createObjectURL } = stubObjectUrl("blob:mock-url");
    let capturedHref = "";
    let capturedDownload = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedHref = this.href;
      capturedDownload = this.download;
    });

    backup.downloadBackup(backupValue);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(capturedHref).toBe("blob:mock-url");
    expect(capturedDownload).toBe("routines-backup-2026-09-17.txt");
  });

  it("revokes the object URL after a delay, not immediately", async () => {
    const { backup } = await freshBackup();
    vi.useFakeTimers();
    const { revokeObjectURL } = stubObjectUrl("blob:mock-url");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    backup.downloadBackup(backupValue);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("defaults to a fresh createBackup() snapshot when none is given", async () => {
    const { backup, storage } = await freshBackup();
    storage.saveRoutine({
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

    backup.downloadBackup();

    // No explicit backup passed — falls back to createBackup(), whose
    // exportedAt is "now", so just check the filename reflects today.
    const today = backup.backupFileName();
    expect(capturedDownload).toBe(today);
  });
});

describe("shareBackup", () => {
  const backupValue = {
    app: "routines" as const,
    version: 1,
    exportedAt: "2026-09-17T12:00:00.000Z",
    locale: null,
    data: { routines: [], state: {} },
  };

  it("returns false when the Web Share API isn't supported", async () => {
    const { backup } = await freshBackup();
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: undefined,
      share: undefined,
    });
    await expect(backup.shareBackup(backupValue)).resolves.toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns false when canShare rejects the file", async () => {
    const { backup } = await freshBackup();
    const canShare = vi.fn().mockReturnValue(false);
    const share = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, canShare, share });
    await expect(backup.shareBackup(backupValue)).resolves.toBe(false);
    expect(share).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shares the backup file and returns true on success", async () => {
    const { backup } = await freshBackup();
    const canShare = vi.fn().mockReturnValue(true);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, canShare, share });

    await expect(backup.shareBackup(backupValue)).resolves.toBe(true);
    expect(canShare).toHaveBeenCalledWith({
      files: [expect.any(File)],
    });
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
    const [sharedFile] = share.mock.calls[0][0].files;
    // Not .json — Chromium's Web Share API file allow-list excludes it, so
    // the shared copy is named/typed as plain text (see shareableBackupFile).
    expect(sharedFile.name).toBe("routines-backup-2026-09-17.txt");
    expect(sharedFile.type).toBe("text/plain");
    vi.unstubAllGlobals();
  });

  it("treats a cancelled share sheet (AbortError) as handled", async () => {
    const { backup } = await freshBackup();
    const canShare = vi.fn().mockReturnValue(true);
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("navigator", { ...navigator, canShare, share });

    await expect(backup.shareBackup(backupValue)).resolves.toBe(true);
    vi.unstubAllGlobals();
  });

  it("returns false when the share itself fails", async () => {
    const { backup } = await freshBackup();
    const canShare = vi.fn().mockReturnValue(true);
    const share = vi.fn().mockRejectedValue(new Error("share failed"));
    vi.stubGlobal("navigator", { ...navigator, canShare, share });

    await expect(backup.shareBackup(backupValue)).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});
