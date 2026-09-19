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
  DriveApiError,
  downloadBackupFile,
  findBackupFileId,
  uploadBackupFile,
} from "@/lib/drive/drive-client";
import { DriveSyncMetaSchema, type DriveSyncMeta } from "@/lib/schemas";
import { DRIVE_SYNC_KEY } from "@/lib/storage-keys";
import * as v from "valibot";

export type { DriveSyncMeta };

/** Thrown when a restore is attempted but nothing has ever been synced. */
export class DriveNoBackupError extends Error {}

const defaultMeta: DriveSyncMeta = { fileId: null, lastSyncedAt: null };

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
    const result = v.safeParse(DriveSyncMetaSchema, JSON.parse(stored));
    return result.success ? result.output : defaultMeta;
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

/** A cached file id, or a fresh search against Drive if there isn't one. */
async function resolveFileId(
  accessToken: string,
  meta: DriveSyncMeta,
): Promise<string | null> {
  return meta.fileId ?? findBackupFileId(accessToken);
}

function isStale404(error: unknown): error is DriveApiError {
  return error instanceof DriveApiError && error.status === 404;
}

/** Pushes the current local data to Drive, creating the file the first time. */
export async function syncToDrive(clientId: string): Promise<void> {
  const accessToken = await requestDriveAccessToken(clientId);
  const meta = getDriveSyncMeta();
  const content = JSON.stringify(createBackup(), null, 2);
  const fileId = await resolveFileId(accessToken, meta);
  let resolvedId: string;
  try {
    resolvedId = await uploadBackupFile(accessToken, content, fileId);
  } catch (error) {
    // The cached file id no longer exists on Drive (deleted, or access to
    // it was revoked) — clear it and create a fresh file instead of failing
    // outright and leaving the stale id cached forever.
    if (fileId && isStale404(error)) {
      resolvedId = await uploadBackupFile(accessToken, content, null);
    } else {
      throw error;
    }
  }
  setDriveSyncMeta({
    fileId: resolvedId,
    lastSyncedAt: new Date().toISOString(),
  });
}

/** Pulls whatever is on Drive and replaces local data with it. */
export async function restoreFromDrive(clientId: string): Promise<void> {
  const accessToken = await requestDriveAccessToken(clientId);
  const meta = getDriveSyncMeta();
  const fileId = await resolveFileId(accessToken, meta);
  if (!fileId) {
    throw new DriveNoBackupError(
      "No Routines backup was found on Google Drive yet.",
    );
  }
  let content: string;
  try {
    content = await downloadBackupFile(accessToken, fileId);
  } catch (error) {
    if (isStale404(error)) {
      setDriveSyncMeta({ fileId: null, lastSyncedAt: meta.lastSyncedAt });
      throw new DriveNoBackupError(
        "No Routines backup was found on Google Drive yet.",
      );
    }
    throw error;
  }
  applyBackup(parseBackup(content));
  setDriveSyncMeta({ fileId, lastSyncedAt: new Date().toISOString() });
}
