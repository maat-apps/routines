import { createAppSettings } from "@maat-apps/core/app-settings";
import type { LockEnrolment } from "@maat-apps/core/lock";

import { keyValueStore, kvDelete } from "@/lib/idb-store";
import { PREFERENCE_KEYS, SETTINGS_KEY } from "@/lib/storage-keys";

/**
 * What we keep about the app lock. The credential id is a handle the platform
 * authenticator gives back — it is not a secret and unlocks nothing on its own.
 * `prfSalt`/`encryptionSupported` are not secret either — they're metadata
 * about whether/how routine data is encrypted (see src/lib/app-lock.ts),
 * not the key itself, which is never stored. Schema and type come from
 * @maat-apps/core/lock.
 */
export type { LockEnrolment };

// @maat-apps/core/app-settings: the lock enrolment, relock choice and
// installed flag (`installed`: Chrome stops re-offering
// `beforeinstallprompt` once installed, so a later visit from a plain
// browser tab has no other way to tell — see `useInstallPrompt`), in memory
// once loaded with IndexedDB behind it, plus routines' own layout choice.
// Its "ready" signal is load-bearing, not just for tests: AppLockGate must
// not treat "not loaded yet" the same as "no lock enrolled" — see
// useSettingsReady() in src/hooks/use-store.ts.
export const appSettings = createAppSettings({
  storage: keyValueStore,
  key: SETTINGS_KEY,
  extra: {
    defaults: {
      /**
       * Routine view layout for one-handed use: the next step sits at the
       * bottom, nearest the thumb, and finished steps collect in a group on
       * top.
       */
      thumbLayout: false,
    },
    parse: (stored) => ({ thumbLayout: stored.thumbLayout === true }),
  },
});

export type AppSettings = ReturnType<typeof appSettings.getSnapshot>;

/** Test-only: resolves once the initial background read has finished. */
export const whenLoaded = appSettings.whenLoaded;
export const subscribeToSettings = appSettings.subscribe;
export const subscribeToSettingsReady = appSettings.subscribeReady;
export const getSettingsSnapshot = appSettings.getSnapshot;
export const getServerSettingsSnapshot = appSettings.getServerSnapshot;
/** Whether the initial background read from IndexedDB has resolved yet. */
export const isSettingsReady = appSettings.isReady;
export const isSettingsReadyOnServer = appSettings.isReadyOnServer;
export const setRelockAfter = appSettings.setRelockAfter;
export const relockAfterMs = appSettings.relockAfterMs;
export const markInstalled = appSettings.markInstalled;

export function setLockEnrolment(lock: LockEnrolment): void {
  appSettings.setLockEnrolment(lock);
}

export function clearLockEnrolment(): void {
  appSettings.setLockEnrolment(null);
}

export function setThumbLayout(thumbLayout: boolean): void {
  appSettings.set({ thumbLayout });
}

/**
 * Clears preferences (language, app lock) and leaves routines untouched.
 * Callers must await this before reloading (the deletes are real IndexedDB
 * writes) and must reload afterwards regardless: the language store caches
 * its own snapshot and would otherwise keep showing the cleared preference.
 */
export async function resetPreferences(): Promise<void> {
  await Promise.all([
    ...PREFERENCE_KEYS.filter((key) => key !== SETTINGS_KEY).map((key) =>
      kvDelete(key),
    ),
    appSettings.reset(),
  ]);
}
