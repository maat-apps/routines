// Opt-in Google Drive sync, built on top of the existing local backup
// format (src/lib/backup.ts) rather than a second data shape — the Drive
// file *is* a backup JSON. Deliberately small in scope: manual "Sync now" /
// "Restore from Drive" only, no automatic background sync and no real
// conflict resolution. A push always overwrites whatever is on Drive
// already; a restore always overwrites what's local. Whichever direction
// the user picks is the one that wins — there's no merge.

import { applyBackup, createBackup, parseBackup } from "@/lib/backup";
import { requestDriveAccessToken } from "@/lib/drive/drive-auth";
import {
  downloadBackupFile,
  findBackupFileId,
  uploadBackupFile,
} from "@/lib/drive/drive-client";
import { DRIVE_SYNC_KEY } from "@/lib/storage-keys";

export type DriveSyncMeta = {
  fileId: string | null;
  lastSyncedAt: string | null;
};

const defaultMeta: DriveSyncMeta = { fileId: null, lastSyncedAt: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Not an access token (those stay in memory only, see drive-auth.ts) — just
 * the resolved file id and a timestamp, so "Last synced" can show something
 * and repeat syncs don't need to re-search Drive for the file every time.
 */
export function getDriveSyncMeta(): DriveSyncMeta {
  if (typeof window === "undefined") return defaultMeta;
  try {
    const stored = window.localStorage.getItem(DRIVE_SYNC_KEY);
    if (!stored) return defaultMeta;
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return defaultMeta;
    return {
      fileId: typeof parsed.fileId === "string" ? parsed.fileId : null,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return defaultMeta;
  }
}

function setDriveSyncMeta(meta: DriveSyncMeta): void {
  try {
    window.localStorage.setItem(DRIVE_SYNC_KEY, JSON.stringify(meta));
  } catch {
    // Not fatal — the sync itself already succeeded; only the "remember the
    // file id / last-synced label" convenience is lost.
  }
}

/** Pushes the current local data to Drive, creating the file the first time. */
export async function syncToDrive(clientId: string): Promise<void> {
  const accessToken = await requestDriveAccessToken(clientId);
  const meta = getDriveSyncMeta();
  const fileId = meta.fileId ?? (await findBackupFileId(accessToken));
  const content = JSON.stringify(createBackup(), null, 2);
  const resolvedId = await uploadBackupFile(accessToken, content, fileId);
  setDriveSyncMeta({
    fileId: resolvedId,
    lastSyncedAt: new Date().toISOString(),
  });
}

/** Pulls whatever is on Drive and replaces local data with it. */
export async function restoreFromDrive(clientId: string): Promise<void> {
  const accessToken = await requestDriveAccessToken(clientId);
  const meta = getDriveSyncMeta();
  const fileId = meta.fileId ?? (await findBackupFileId(accessToken));
  if (!fileId) {
    throw new Error("No Routines backup was found on Google Drive yet.");
  }
  const content = await downloadBackupFile(accessToken, fileId);
  applyBackup(parseBackup(content));
  setDriveSyncMeta({ fileId, lastSyncedAt: new Date().toISOString() });
}
