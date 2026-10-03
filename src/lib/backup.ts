import {
  BackupError,
  backupFileName as coreBackupFileName,
  downloadBackup as coreDownloadBackup,
  shareBackup as coreShareBackup,
  readBackupEnvelope,
  readBackupJson,
  type ShareResult,
} from "@maat-apps/core/backup";

import {
  getLocaleSnapshot,
  isLocale,
  setStoredLocale,
} from "@/lib/locale-store";
import { parseBackupEnvelope, parseRoutines, parseState } from "@/lib/schemas";
import { getRawData, mergeIntoData, replaceAllData } from "@/lib/storage";
import type { AppData } from "@/types";

// Routines' backup format on top of @maat-apps/core/backup, which handles
// the envelope checks, the backup file and getting it to the user. What's
// routines' own: the data (routines + progress), the locale, and the
// messages.

export { BackupError };

export const BACKUP_VERSION = 1;

export type Backup = {
  app: "routines";
  version: number;
  exportedAt: string;
  locale: string | null;
  data: AppData;
};

const messages = {
  notJson: "The file is not valid JSON.",
  wrongApp: "The file is not a Routines backup.",
  wrongVersion: "The backup was made by a different app version.",
};

/** Snapshots everything worth keeping, ready to be serialised to a file. */
export function createBackup(): Backup {
  return {
    app: "routines",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    locale: getLocaleSnapshot(),
    data: getRawData(),
  };
}

/**
 * Validates a backup file. Import runs on a user-supplied file, so anything
 * unrecognised is dropped rather than trusted.
 */
export function parseBackup(text: string): Backup {
  return parseBackupValue(readBackupJson(text, messages));
}

/**
 * Same validation as `parseBackup`, for a value that's already an object —
 * e.g. one read back from IndexedDB, which stores structured-cloned values
 * rather than JSON text.
 */
export function parseBackupValue(parsed: unknown): Backup {
  const envelope = parseBackupEnvelope(
    readBackupEnvelope(parsed, {
      app: "routines",
      version: BACKUP_VERSION,
      messages,
    }),
  );
  if (!envelope) {
    throw new BackupError("The backup does not contain any routines.");
  }

  return {
    app: "routines",
    version: BACKUP_VERSION,
    exportedAt: envelope.exportedAt,
    locale: envelope.locale,
    data: {
      routines: parseRoutines(envelope.data.routines),
      state: parseState(envelope.data.state),
    },
  };
}

/**
 * Import from Settings: keeps the routines on the device and adds the
 * backup's. The language is a setting of this device, so it stays as is.
 */
export function mergeBackup(backup: Backup): void {
  mergeIntoData(backup.data);
}

/** Overwrites the current routines with the backup's (restoring the update snapshot). */
export function applyBackup(backup: Backup): void {
  replaceAllData(backup.data);
  if (isLocale(backup.locale)) {
    // Goes through the locale store so its cached snapshot and listeners
    // update in the same tick — otherwise the UI keeps showing the old
    // language until a manual reload.
    setStoredLocale(backup.locale);
  }
}

/** `routines-backup-YYYY-MM-DD.txt` (plain text: see core's backupFileName). */
export function backupFileName(date = new Date()): string {
  return coreBackupFileName("routines", date);
}

/** Hands the browser the backup file to save. */
export function downloadBackup(backup: Backup = createBackup()): void {
  coreDownloadBackup(backup);
}

export type ShareBackupResult = ShareResult;

/**
 * Offers the backup file to the OS share sheet (e.g. straight to a cloud
 * drive). `"cancelled"` is a normal outcome; on `"unavailable"`, fall back
 * to `downloadBackup`.
 */
export function shareBackup(
  backup: Backup = createBackup(),
): Promise<ShareBackupResult> {
  return coreShareBackup(backup);
}
