import {
  DEFAULT_RELOCK_AFTER_MS,
  parseLockEnrolment,
  type LockEnrolment,
} from "@maat-apps/core/lock";
import { createPersistedStore } from "@maat-apps/core/persisted";

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

/** Right away, after 30 seconds in the background, or only once closed. */
export const RELOCK_CHOICES = ["now", "30s", "close"] as const;
export type RelockAfter = (typeof RELOCK_CHOICES)[number];

const RELOCK_AFTER_MS: Record<RelockAfter, number | null> = {
  now: 0,
  "30s": DEFAULT_RELOCK_AFTER_MS,
  close: null,
};

export type AppSettings = {
  lock: LockEnrolment | null;
  /** How soon the lock comes back once the app is left. */
  relockAfter: RelockAfter;
  /**
   * Whether this browser has ever reported the app as installed (standalone
   * launch or the `appinstalled` event). Chrome stops re-offering
   * `beforeinstallprompt` once installed, so a later visit from a plain
   * browser tab has no other way to tell — see `useInstallPrompt`.
   */
  installed: boolean;
  /**
   * Routine view layout for one-handed use: the next step sits at the bottom,
   * nearest the thumb, and finished steps collect in a group on top.
   */
  thumbLayout: boolean;
};

const defaultSettings: AppSettings = {
  lock: null,
  relockAfter: "30s",
  installed: false,
  thumbLayout: false,
};

// @maat-apps/core/persisted: in memory once loaded, IndexedDB behind it. Its
// "ready" signal is load-bearing here, not just for tests: AppLockGate must
// not treat "not loaded yet" the same as "no lock enrolled" — see
// useSettingsReady() in src/hooks/use-store.ts.
const settingsStore = createPersistedStore<AppSettings>({
  storage: keyValueStore,
  key: SETTINGS_KEY,
  defaults: defaultSettings,
  parse: (stored) => {
    const value = stored as Record<string, unknown>;
    return {
      lock: parseLockEnrolment(value.lock),
      relockAfter:
        RELOCK_CHOICES.find((choice) => choice === value.relockAfter) ?? "30s",
      installed: value.installed === true,
      thumbLayout: value.thumbLayout === true,
    };
  },
});

/** Test-only: resolves once the initial background read has finished. */
export const whenLoaded = settingsStore.whenLoaded;
export const subscribeToSettings = settingsStore.subscribe;
export const subscribeToSettingsReady = settingsStore.subscribeReady;
export const getSettingsSnapshot = settingsStore.getSnapshot;
export const getServerSettingsSnapshot = settingsStore.getServerSnapshot;
/** Whether the initial background read from IndexedDB has resolved yet. */
export const isSettingsReady = settingsStore.isReady;

export function isSettingsReadyOnServer(): boolean {
  return false;
}

export function setLockEnrolment(lock: LockEnrolment): void {
  settingsStore.set({ lock });
}

export function clearLockEnrolment(): void {
  settingsStore.set({ lock: null });
}

export function setThumbLayout(thumbLayout: boolean): void {
  settingsStore.set({ thumbLayout });
}

export function setRelockAfter(relockAfter: RelockAfter): void {
  settingsStore.set({ relockAfter });
}

/** The lock's `relockAfterMs`: read on every hide, so a change applies at once. */
export function relockAfterMs(): number | null {
  return RELOCK_AFTER_MS[getSettingsSnapshot().relockAfter];
}

export function markInstalled(): void {
  if (getSettingsSnapshot().installed) return;
  settingsStore.set({ installed: true });
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
    settingsStore.reset(),
  ]);
}
