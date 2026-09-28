import { createLocaleStore } from "@maat-apps/core/locale";

import { keyValueStore } from "@/lib/idb-store";
import { LOCALE_KEY } from "@/lib/storage-keys";

// The non-React half of i18n (@maat-apps/core/locale): readable from plain lib
// code (e.g. backup import) as well as from src/i18n/use-translation.ts. On
// first launch it guesses from the device language; once stored, the user's
// choice always wins.

const LOCALES = ["pl", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const localeStore = createLocaleStore<Locale>({
  locales: LOCALES,
  fallbackLocale: DEFAULT_LOCALE,
  storage: keyValueStore,
  storageKey: LOCALE_KEY,
});

export const isLocale = localeStore.isLocale;
/** Test-only: resolves once the stored choice has been read. */
export const whenLoaded = localeStore.whenLoaded;
export const getLocaleSnapshot = localeStore.getSnapshot;
export const getServerLocaleSnapshot = localeStore.getServerSnapshot;
export const subscribeToLocale = localeStore.subscribe;
export const setStoredLocale = localeStore.setLocale;
