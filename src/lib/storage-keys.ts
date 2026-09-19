// Every localStorage key the app owns, in one place — backup, reset and the
// update snapshot all need to agree on this list.

/** Routines and their per-day progress (`src/lib/storage.ts`). */
export const DATA_KEY = "routines-data";

/** Interface language (`src/components/i18n-provider.tsx`). */
export const LOCALE_KEY = "routines-locale";

/** App-lock enrolment (`src/lib/settings.ts`). */
export const SETTINGS_KEY = "routines-settings";

/** Automatic backup taken just before an in-app update. */
export const SNAPSHOT_KEY = "routines-update-snapshot";

/**
 * Google Drive sync metadata — the resolved backup file id and last-synced
 * timestamp (`src/lib/drive/drive-sync.ts`). Never an access token: those
 * are short-lived and kept in memory only, never persisted.
 */
export const DRIVE_SYNC_KEY = "routines-drive-sync";

/** Keys cleared by "reset settings" — preferences only, never routine data. */
export const PREFERENCE_KEYS = [
  LOCALE_KEY,
  SETTINGS_KEY,
  DRIVE_SYNC_KEY,
] as const;
