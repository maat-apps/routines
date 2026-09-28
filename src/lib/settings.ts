import { createPersistedStore } from "@maat-apps/core/persisted";

import { keyValueStore, kvDelete } from "@/lib/idb-store";
import { parseLockEnrolment, type LockEnrolment } from "@/lib/schemas";
import { PREFERENCE_KEYS, SETTINGS_KEY } from "@/lib/storage-keys";

/**
 * What we keep about the app lock. The credential id is a handle the platform
 * authenticator gives back — it is not a secret and unlocks nothing on its own.
 * `prfSalt`/`encryptionSupported` are not secret either — they're metadata
 * about whether/how routine data is encrypted (see src/lib/webauthn-crypto.ts),
 * not the key itself, which is never stored. Defined as a schema in
 * @/lib/schemas (LockEnrolmentSchema) rather than a parallel hand-written
 * type, so this type and parseLockEnrolment below can't drift apart.
 */
export type { LockEnrolment };

export type AppSettings = {
  lock: LockEnrolment | null;
  /**
   * Whether this browser has ever reported the app as installed (standalone
   * launch or the `appinstalled` event). Chrome stops re-offering
   * `beforeinstallprompt` once installed, so a later visit from a plain
   * browser tab has no other way to tell — see `useInstallPrompt`.
   */
  installed: boolean;
};

const defaultSettings: AppSettings = { lock: null, installed: false };

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
      installed: value.installed === true,
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
