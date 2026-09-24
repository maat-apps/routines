import { kvDelete, kvGet, kvSet } from "@/lib/idb-store";
import { PREFERENCE_KEYS, SETTINGS_KEY } from "@/lib/storage-keys";

/**
 * What we keep about the app lock. The credential id is a handle the platform
 * authenticator gives back — it is not a secret and unlocks nothing on its own.
 */
export type LockEnrolment = {
  credentialId: string;
  userId: string;
  createdAt: string;
};

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

// Same tiny external-store shape as src/lib/storage.ts, so the settings screen
// can subscribe with `useSyncExternalStore` without a hydration mismatch.
const listeners = new Set<() => void>();
const readyListeners = new Set<() => void>();
let snapshot: AppSettings = defaultSettings;
// Whether the initial background read from IndexedDB has resolved. Unlike
// storage.ts/locale-store.ts, this one is load-bearing for a real consumer,
// not just tests: AppLockGate must not treat "not loaded yet" the same as
// "no lock enrolled" — see useSettingsReady() in src/hooks/use-store.ts.
let ready = false;
let loaded: Promise<void> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLock(value: unknown): LockEnrolment | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.credentialId !== "string" ||
    typeof value.userId !== "string"
  ) {
    return null;
  }
  return {
    credentialId: value.credentialId,
    userId: value.userId,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
  };
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function notifyReady(): void {
  for (const listener of readyListeners) {
    listener();
  }
}

function ensureLoaded(): void {
  if (loaded) return;
  if (typeof window === "undefined") return;

  loaded = kvGet<Record<string, unknown>>(SETTINGS_KEY)
    .then((stored) => {
      if (stored) {
        snapshot = {
          lock: parseLock(stored.lock),
          installed: stored.installed === true,
        };
      }
    })
    .catch(() => {
      // Keep defaultSettings.
    })
    .finally(() => {
      ready = true;
      notifyReady();
      notify();
    });
}

/**
 * Resolves once the initial background read from IndexedDB has finished —
 * test-only, mirrors storage.ts's/locale-store.ts's own `whenLoaded()`.
 */
export function whenLoaded(): Promise<void> {
  ensureLoaded();
  return loaded ?? Promise.resolve();
}

function write(settings: AppSettings): void {
  snapshot = settings;
  void kvSet(SETTINGS_KEY, settings);
  notify();
}

export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToSettingsReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}

export function getSettingsSnapshot(): AppSettings {
  ensureLoaded();
  return snapshot;
}

export function getServerSettingsSnapshot(): AppSettings {
  return defaultSettings;
}

/** Whether the initial background read from IndexedDB has resolved yet. */
export function isSettingsReady(): boolean {
  ensureLoaded();
  return ready;
}

export function isSettingsReadyOnServer(): boolean {
  return false;
}

export function setLockEnrolment(lock: LockEnrolment): void {
  write({ ...getSettingsSnapshot(), lock });
}

export function clearLockEnrolment(): void {
  write({ ...getSettingsSnapshot(), lock: null });
}

export function markInstalled(): void {
  if (getSettingsSnapshot().installed) return;
  write({ ...getSettingsSnapshot(), installed: true });
}

/**
 * Clears preferences (language, app lock) and leaves routines untouched.
 * Callers must await this before reloading (the deletes are real IndexedDB
 * writes, not instant like the old localStorage.removeItem) and must reload
 * afterwards regardless: the language store caches its own snapshot and
 * would otherwise keep showing the cleared preference.
 */
export async function resetPreferences(): Promise<void> {
  await Promise.all(PREFERENCE_KEYS.map((key) => kvDelete(key)));
  snapshot = defaultSettings;
  notify();
}
