import {
  BackupError,
  createLocalBackup,
  type LocalBackup,
} from "@maat-apps/core/local";
import { isRecord } from "@maat-apps/core/validation";

import { encryptionKey } from "@/lib/encryption-key";
import { keyValueStore } from "@/lib/idb-store";
import {
  getLocaleSnapshot,
  isLocale,
  setStoredLocale,
} from "@/lib/locale-store";
import { parseRoutines, parseState } from "@/lib/schemas";
import { dataStore } from "@/lib/storage";
import { SNAPSHOT_KEY } from "@/lib/storage-keys";
import type { AppData } from "@/types";

// Routines' backup and pre-update snapshot (@maat-apps/core/local): the
// routines and progress as `data`, plus the language. Import runs on a
// user-supplied file, so anything unrecognised is dropped rather than
// trusted — per routine, through the same schemas as storage read-back.

export { BackupError };

export const BACKUP_VERSION = 1;

/** A backup: routines + progress as `data`, the language as `locale`. */
export type Backup = LocalBackup<AppData>;

export const backups = createLocalBackup({
  app: "routines",
  version: BACKUP_VERSION,
  store: dataStore,
  exactVersion: true,
  messages: {
    notJson: "The file is not valid JSON.",
    wrongApp: "The file is not a Routines backup.",
    wrongVersion: "The backup was made by a different app version.",
  },
  parseData: (data) => {
    if (!isRecord(data) || !Array.isArray(data.routines)) {
      throw new BackupError("The backup does not contain any routines.");
    }
    return {
      routines: parseRoutines(data.routines),
      state: parseState(data.state),
    };
  },
  extras: {
    create: () => ({ locale: getLocaleSnapshot() }),
    parse: ({ locale }) => ({
      locale: typeof locale === "string" ? locale : null,
    }),
    apply: ({ locale }) => {
      // Goes through the locale store so its cached snapshot and listeners
      // update in the same tick — otherwise the UI keeps showing the old
      // language until a manual reload.
      if (isLocale(locale)) setStoredLocale(locale);
    },
  },
  snapshot: {
    storage: keyValueStore,
    key: SNAPSHOT_KEY,
    keyHolder: encryptionKey,
  },
});

/** Snapshots everything worth keeping, ready to be serialised to a file. */
export const createBackup = backups.create;

/** Validates a backup file. */
export const parseBackup = backups.parse;

/**
 * Same validation as `parseBackup`, for a value that's already an object —
 * e.g. one read back from IndexedDB, which stores structured-cloned values
 * rather than JSON text.
 */
export const parseBackupValue = backups.parseValue;

/** Overwrites the current routines (and the language) with the backup's. */
export const applyBackup = backups.apply;

/** `routines-backup-YYYY-MM-DD.txt` (plain text: see core's backupFileName). */
export const backupFileName = backups.fileName;

/** Hands the browser the backup file to save. */
export const downloadBackup = backups.download;

/**
 * Offers the backup file to the OS share sheet (e.g. straight to a cloud
 * drive). `"cancelled"` is a normal outcome; on `"unavailable"`, fall back
 * to `downloadBackup`.
 */
export const shareBackup = backups.share;
