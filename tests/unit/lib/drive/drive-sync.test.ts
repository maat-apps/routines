import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/drive/drive-auth", () => ({
  requestDriveAccessToken: vi.fn(),
}));
const { MockDriveApiError } = vi.hoisted(() => ({
  MockDriveApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/drive/drive-client", () => ({
  DriveApiError: MockDriveApiError,
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
  DriveApiError,
  downloadBackupFile,
  findBackupFileId,
  uploadBackupFile,
} from "@/lib/drive/drive-client";
import {
  DriveNoBackupError,
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

  it("recreates the file when the cached id no longer exists on Drive", async () => {
    localStorage.setItem(
      DRIVE_SYNC_KEY,
      JSON.stringify({ fileId: "stale-file", lastSyncedAt: null }),
    );
    vi.mocked(createBackup).mockReturnValue({
      app: "routines",
      version: 1,
      exportedAt: "now",
      locale: null,
      data: { routines: [], state: {} },
    });
    vi.mocked(uploadBackupFile)
      .mockRejectedValueOnce(new DriveApiError(404, "Not found."))
      .mockResolvedValueOnce("fresh-file-id");

    await syncToDrive("client-id");

    expect(uploadBackupFile).toHaveBeenNthCalledWith(
      1,
      "token",
      expect.any(String),
      "stale-file",
    );
    expect(uploadBackupFile).toHaveBeenNthCalledWith(
      2,
      "token",
      expect.any(String),
      null,
    );
    expect(getDriveSyncMeta().fileId).toBe("fresh-file-id");
  });

  it("propagates a non-404 upload failure without retrying", async () => {
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
    vi.mocked(uploadBackupFile).mockRejectedValue(
      new DriveApiError(500, "Server error."),
    );

    await expect(syncToDrive("client-id")).rejects.toThrow("Server error.");
    expect(uploadBackupFile).toHaveBeenCalledTimes(1);
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

  it("throws DriveNoBackupError instead of downloading when no backup file exists yet", async () => {
    vi.mocked(findBackupFileId).mockResolvedValue(null);

    await expect(restoreFromDrive("client-id")).rejects.toThrow(
      DriveNoBackupError,
    );
    expect(downloadBackupFile).not.toHaveBeenCalled();
  });

  it("clears a stale cached id and throws DriveNoBackupError when it 404s", async () => {
    localStorage.setItem(
      DRIVE_SYNC_KEY,
      JSON.stringify({
        fileId: "stale-file",
        lastSyncedAt: "2026-09-18T00:00:00Z",
      }),
    );
    vi.mocked(downloadBackupFile).mockRejectedValue(
      new DriveApiError(404, "Not found."),
    );

    await expect(restoreFromDrive("client-id")).rejects.toThrow(
      DriveNoBackupError,
    );
    expect(findBackupFileId).not.toHaveBeenCalled();
    const meta = getDriveSyncMeta();
    expect(meta.fileId).toBeNull();
    expect(meta.lastSyncedAt).toBe("2026-09-18T00:00:00Z");
  });

  it("propagates a non-404 download failure as-is", async () => {
    vi.mocked(findBackupFileId).mockResolvedValue("file-1");
    vi.mocked(downloadBackupFile).mockRejectedValue(
      new DriveApiError(500, "Server error."),
    );

    await expect(restoreFromDrive("client-id")).rejects.toThrow(
      "Server error.",
    );
  });
});
