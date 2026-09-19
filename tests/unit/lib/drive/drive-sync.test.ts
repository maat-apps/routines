import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drive/drive-auth", () => ({
  requestDriveAccessToken: vi.fn(),
}));
vi.mock("@/lib/drive/drive-client", () => ({
  findBackupFileId: vi.fn(),
  uploadBackupFile: vi.fn(),
  downloadBackupFile: vi.fn(),
}));
vi.mock("@/lib/backup", () => ({
  createBackup: vi.fn(),
  parseBackup: vi.fn(),
  applyBackup: vi.fn(),
}));

import { applyBackup, createBackup, parseBackup } from "@/lib/backup";
import { requestDriveAccessToken } from "@/lib/drive/drive-auth";
import {
  downloadBackupFile,
  findBackupFileId,
  uploadBackupFile,
} from "@/lib/drive/drive-client";
import {
  getDriveSyncMeta,
  restoreFromDrive,
  syncToDrive,
} from "@/lib/drive/drive-sync";
import { DRIVE_SYNC_KEY } from "@/lib/storage-keys";

beforeEach(() => {
  localStorage.clear();
  vi.mocked(requestDriveAccessToken).mockResolvedValue("token");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getDriveSyncMeta", () => {
  it("defaults to no file id and never synced", () => {
    expect(getDriveSyncMeta()).toEqual({ fileId: null, lastSyncedAt: null });
  });

  it("reads back what was previously stored", () => {
    localStorage.setItem(
      DRIVE_SYNC_KEY,
      JSON.stringify({ fileId: "f1", lastSyncedAt: "2026-09-18T00:00:00Z" }),
    );
    expect(getDriveSyncMeta()).toEqual({
      fileId: "f1",
      lastSyncedAt: "2026-09-18T00:00:00Z",
    });
  });

  it("falls back to defaults instead of throwing on corrupted data", () => {
    localStorage.setItem(DRIVE_SYNC_KEY, "{not json");
    expect(getDriveSyncMeta()).toEqual({ fileId: null, lastSyncedAt: null });
  });

  it("falls back to defaults for valid JSON that isn't an object", () => {
    localStorage.setItem(DRIVE_SYNC_KEY, JSON.stringify([1, 2, 3]));
    expect(getDriveSyncMeta()).toEqual({ fileId: null, lastSyncedAt: null });
  });
});

describe("syncToDrive", () => {
  it("creates the file the first time and remembers its id", async () => {
    vi.mocked(createBackup).mockReturnValue({
      app: "routines",
      version: 1,
      exportedAt: "now",
      locale: null,
      data: { routines: [], state: {} },
    });
    vi.mocked(findBackupFileId).mockResolvedValue(null);
    vi.mocked(uploadBackupFile).mockResolvedValue("new-file-id");

    await syncToDrive("client-id");

    expect(requestDriveAccessToken).toHaveBeenCalledWith("client-id");
    expect(findBackupFileId).toHaveBeenCalledWith("token");
    expect(uploadBackupFile).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      null,
    );
    const meta = getDriveSyncMeta();
    expect(meta.fileId).toBe("new-file-id");
    expect(meta.lastSyncedAt).not.toBeNull();
  });

  it("reuses a remembered file id without searching Drive again", async () => {
    localStorage.setItem(
      DRIVE_SYNC_KEY,
      JSON.stringify({ fileId: "known-file", lastSyncedAt: null }),
    );
    vi.mocked(createBackup).mockReturnValue({
      app: "routines",
      version: 1,
      exportedAt: "now",
      locale: null,
      data: { routines: [], state: {} },
    });
    vi.mocked(uploadBackupFile).mockResolvedValue("known-file");

    await syncToDrive("client-id");

    expect(findBackupFileId).not.toHaveBeenCalled();
    expect(uploadBackupFile).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      "known-file",
    );
  });
});

describe("restoreFromDrive", () => {
  it("downloads, parses, and applies the backup", async () => {
    vi.mocked(findBackupFileId).mockResolvedValue("file-1");
    vi.mocked(downloadBackupFile).mockResolvedValue('{"app":"routines"}');
    const parsed = {
      app: "routines" as const,
      version: 1,
      exportedAt: "now",
      locale: null,
      data: { routines: [], state: {} },
    };
    vi.mocked(parseBackup).mockReturnValue(parsed);

    await restoreFromDrive("client-id");

    expect(downloadBackupFile).toHaveBeenCalledWith("token", "file-1");
    expect(parseBackup).toHaveBeenCalledWith('{"app":"routines"}');
    expect(applyBackup).toHaveBeenCalledWith(parsed);
    expect(getDriveSyncMeta().fileId).toBe("file-1");
  });

  it("throws instead of downloading when no backup file exists yet", async () => {
    vi.mocked(findBackupFileId).mockResolvedValue(null);

    await expect(restoreFromDrive("client-id")).rejects.toThrow(
      /no routines backup/i,
    );
    expect(downloadBackupFile).not.toHaveBeenCalled();
  });
});
