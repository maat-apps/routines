import { createTranslation } from "@maat-apps/core/i18n";

import { localeStore } from "@/lib/locale-store";

import en from "./en.json";
import pl from "./pl.json";

export type { Locale } from "@/lib/locale-store";
export { DEFAULT_LOCALE } from "@/lib/locale-store";

/**
 * `{ locale, setLocale, t }` — no provider; the locale store is a singleton.
 * `t()` only accepts keys present in both catalogs, so keep en.json and
 * pl.json in sync.
 */
export const useTranslation = createTranslation(localeStore, { en, pl });
