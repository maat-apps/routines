import { kvGet, kvSet } from "@/lib/idb-store";
import { LOCALE_KEY } from "@/lib/storage-keys";

// The non-React half of the i18n store: a module-level singleton so it can be
// read/written from plain lib code (e.g. backup import) as well as from
// src/i18n/use-translation.ts's useSyncExternalStore-backed hook. Kept here,
// not in i18n/, so lib/ stays free of react/react-dom imports per CLAUDE.md.

export type Locale = "pl" | "en";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "pl" || value === "en";
}

// First launch only: no stored preference yet, so fall back to the device's
// language (navigator.language, e.g. "pl-PL") instead of always defaulting to
// English. Once a value is stored — including this detected one — it always
// wins; this never overrides a choice the user already made.
function detectLocale(): Locale {
  const language = window.navigator?.language ?? "";
  return language.toLowerCase().startsWith("pl") ? "pl" : DEFAULT_LOCALE;
}

const listeners = new Set<() => void>();
let localeSnapshot: Locale | null = null;
let loaded: Promise<void> | null = null;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

// The snapshot starts as the instant, synchronous device-language guess so
// there's no loading gap for locale specifically; this only ever corrects it
// in the background if a previously-stored choice disagrees.
function ensureLoaded(): void {
  if (loaded) return;
  if (typeof window === "undefined") return;
  localeSnapshot ??= detectLocale();

  loaded = kvGet<unknown>(LOCALE_KEY)
    .then((stored) => {
      if (isLocale(stored)) {
        if (stored !== localeSnapshot) {
          localeSnapshot = stored;
          notify();
        }
      } else if (localeSnapshot) {
        // First-ever run: persist the guessed default so it's what's
        // actually stored, matching this store's "once stored, it always
        // wins" contract above.
        void kvSet(LOCALE_KEY, localeSnapshot);
      }
    })
    .catch(() => {
      // Keep the guessed default.
    });
}

/**
 * Resolves once the initial background read from IndexedDB has finished.
 * Real screens never need this (the guessed default is already correct in
 * the common case) — it exists so tests can await readiness deterministically.
 */
export function whenLoaded(): Promise<void> {
  ensureLoaded();
  return loaded ?? Promise.resolve();
}

export function getLocaleSnapshot(): Locale {
  ensureLoaded();
  return localeSnapshot ?? DEFAULT_LOCALE;
}

export function getServerLocaleSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setStoredLocale(next: Locale): void {
  localeSnapshot = next;
  void kvSet(LOCALE_KEY, next);
  notify();
}
