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

// Same tiny external-store shape as src/lib/use-store.ts, so the settings screen
// can subscribe with `useSyncExternalStore` without a hydration mismatch.
const listeners = new Set<() => void>();
let snapshot: AppSettings | null = null;

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

function read(): AppSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored);
    return {
      lock: parseLock(parsed?.lock),
      installed: parsed?.installed === true,
    };
  } catch {
    return defaultSettings;
  }
}

function write(settings: AppSettings): void {
  snapshot = settings;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked; the change simply won't survive a reload.
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSettingsSnapshot(): AppSettings {
  if (snapshot === null) {
    snapshot = read();
  }
  return snapshot;
}

export function getServerSettingsSnapshot(): AppSettings {
  return defaultSettings;
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
 * Callers must reload afterwards: the language store caches its own snapshot
 * and would otherwise keep showing the cleared preference.
 */
export function resetPreferences(): void {
  for (const key of PREFERENCE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to undo — carry on with the remaining keys.
    }
  }
  snapshot = defaultSettings;
  for (const listener of listeners) {
    listener();
  }
}
