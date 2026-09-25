import * as v from "valibot";

import {
  getLocaleSnapshot,
  isLocale,
  setStoredLocale,
} from "@/lib/locale-store";
import { formatDateStamp } from "@/lib/routine-utils";
import { parseBackupEnvelope, parseRoutines, parseState } from "@/lib/schemas";
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
  if (!v.safeParse(v.object({ app: v.literal("routines") }), parsed).success) {
    throw new BackupError("The file is not a Routines backup.");
  }
  if (
    !v.safeParse(v.object({ version: v.literal(BACKUP_VERSION) }), parsed)
      .success
  ) {
    throw new BackupError("The backup was made by a different app version.");
  }
  const envelope = parseBackupEnvelope(parsed);
  if (!envelope) {
    throw new BackupError("The backup does not contain any routines.");
  }

  const routines = parseRoutines(envelope.data.routines);

  return {
    app: "routines",
    version: BACKUP_VERSION,
    exportedAt: envelope.exportedAt,
    locale: envelope.locale,
    data: { routines, state: parseState(envelope.data.state) },
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

/**
 * `.txt`/`text/plain`, not `.json`/`application/json`, on both export
 * paths — Chromium's Web Share API file allow-list doesn't include JSON
 * (`canShare` just silently returns `false` for it), so sharing needs
 * plain text, and download uses the same format rather than splitting the
 * two into different file types. `parseBackup` only ever reads the text
 * content, never the filename/extension, so this doesn't affect import.
 */
export function backupFileName(date = new Date()): string {
  return `routines-backup-${formatDateStamp(date)}.txt`;
}

function backupFile(backup: Backup): File {
  return new File(
    [JSON.stringify(backup, null, 2)],
    backupFileName(new Date(backup.exportedAt)),
    { type: "text/plain" },
  );
}

/** Hands the browser a JSON file (named/typed as plain text) to save. */
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

export type ShareBackupResult = "shared" | "cancelled" | "unavailable";

/**
 * Offers the backup file to the OS share sheet, so it can go straight to a
 * cloud drive instead of the phone's Downloads folder.
 *
 * - `"shared"` — the user picked a target and the share succeeded.
 * - `"cancelled"` — the user dismissed the share sheet (`AbortError`); a
 *   normal outcome, not a failure to fall back from.
 * - `"unavailable"` — the API (or a file share) isn't supported here, or the
 *   share itself failed outright; the caller should fall back to
 *   `downloadBackup` instead.
 */
export async function shareBackup(
  backup: Backup = createBackup(),
): Promise<ShareBackupResult> {
  if (!navigator.canShare || !navigator.share) return "unavailable";
  const file = backupFile(backup);
  if (!navigator.canShare({ files: [file] })) return "unavailable";
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (error) {
    // DOMException (what navigator.share rejects with) doesn't reliably
    // extend Error across environments, so check `name` directly rather
    // than narrowing with `instanceof Error` first.
    const cancelled =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError";
    return cancelled ? "cancelled" : "unavailable";
  }
}
