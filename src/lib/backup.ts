import {
  getLocaleSnapshot,
  isLocale,
  setStoredLocale,
} from "@/lib/locale-store";
import { parseRoutines, parseState } from "@/lib/schemas";
import { getRawData, replaceAllData } from "@/lib/storage";
import type { AppData } from "@/types";

export const BACKUP_VERSION = 1;

export type Backup = {
  app: "routines";
  version: number;
  exportedAt: string;
  locale: string | null;
  data: AppData;
};

export class BackupError extends Error {}

// Narrows the top-level backup envelope only (app/version/data), so parseBackup
// can give a distinct message per broken expectation. The routines/state inside
// data.* are validated separately by the schemas in @/lib/schemas.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("The file is not valid JSON.");
  }
  return parseBackupValue(parsed);
}

/**
 * Same validation as `parseBackup`, for a value that's already an object —
 * e.g. one read back from IndexedDB, which stores structured-cloned values
 * rather than JSON text.
 */
export function parseBackupValue(parsed: unknown): Backup {
  if (!isRecord(parsed) || parsed.app !== "routines") {
    throw new BackupError("The file is not a Routines backup.");
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new BackupError("The backup was made by a different app version.");
  }
  if (!isRecord(parsed.data) || !Array.isArray(parsed.data.routines)) {
    throw new BackupError("The backup does not contain any routines.");
  }

  const routines = parseRoutines(parsed.data.routines);

  return {
    app: "routines",
    version: BACKUP_VERSION,
    exportedAt:
      typeof parsed.exportedAt === "string"
        ? parsed.exportedAt
        : new Date().toISOString(),
    locale: typeof parsed.locale === "string" ? parsed.locale : null,
    data: { routines, state: parseState(parsed.data.state) },
  };
}

/** Overwrites the current routines with the backup's. */
export function applyBackup(backup: Backup): void {
  replaceAllData(backup.data);
  if (isLocale(backup.locale)) {
    // Goes through the locale store (not a direct localStorage write) so its
    // cached snapshot and listeners update in the same tick — otherwise the
    // UI keeps showing the old language until a manual reload.
    setStoredLocale(backup.locale);
  }
}

export function backupFileName(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `routines-backup-${stamp}.json`;
}

function backupFile(backup: Backup): File {
  return new File(
    [JSON.stringify(backup, null, 2)],
    backupFileName(new Date(backup.exportedAt)),
    { type: "application/json" },
  );
}

/**
 * Same content as `backupFile`, but named/typed as plain text. Chromium's
 * Web Share API file allow-list doesn't include `application/json`/`.json`
 * — `canShare` just returns `false` for it, silently — so sharing uses this
 * instead. `parseBackup` only ever reads the text content, never the
 * filename, so a share round-trips through import exactly the same.
 */
function shareableBackupFile(backup: Backup): File {
  return new File(
    [JSON.stringify(backup, null, 2)],
    backupFileName(new Date(backup.exportedAt)).replace(/\.json$/, ".txt"),
    { type: "text/plain" },
  );
}

/** Hands the browser a JSON file to save. */
export function downloadBackup(backup: Backup = createBackup()): void {
  const url = URL.createObjectURL(backupFile(backup));
  const link = document.createElement("a");

  link.href = url;
  link.download = backupFileName(new Date(backup.exportedAt));
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Offers the backup file to the OS share sheet, so it can go straight to a
 * cloud drive instead of the phone's Downloads folder. Returns whether the
 * share was handled (shown to the user, or successfully shared) — `false`
 * means the caller should fall back to `downloadBackup` instead, because the
 * API isn't supported here or the share itself failed outright. The user
 * cancelling the share sheet (`AbortError`) counts as handled, not a
 * failure to fall back from.
 */
export async function shareBackup(
  backup: Backup = createBackup(),
): Promise<boolean> {
  if (!navigator.canShare || !navigator.share) return false;
  const file = shareableBackupFile(backup);
  if (!navigator.canShare({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (error) {
    // DOMException (what navigator.share rejects with) doesn't reliably
    // extend Error across environments, so check `name` directly rather
    // than narrowing with `instanceof Error` first.
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    );
  }
}
