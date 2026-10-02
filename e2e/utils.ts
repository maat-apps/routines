import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, type Page } from "@playwright/test";

const DATA_KEY = "routines-data";

function loadCatalog(relativePath: string): Record<string, string> {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      "utf-8",
    ),
  ) as Record<string, string>;
}

// The real strings, read from their actual source rather than retyped by
// hand into each spec — playwright.config.ts pins `locale: "en-US"` so the
// app's own navigator.language-based detection (locale-store.ts) always
// lands on "en" here, matching this file. Without both halves (a pinned
// locale AND assertions sourced from en.json instead of hand-copied
// literals), these tests would pass or fail depending on whichever locale
// the CI runner's Chromium happened to default to, and a wording change in
// en.json could silently stop matching hand-copied strings without any
// test catching the drift.
export const en = loadCatalog("../src/i18n/en.json");

// Only for asserting the *other* locale actually took effect after
// switching (settings.spec.ts) — the suite otherwise stays on "en"
// throughout (see the locale pin above), this isn't a second default.
export const pl = loadCatalog("../src/i18n/pl.json");

/** Mirrors use-translation.ts's own `{placeholder}` substitution. */
export function t(key: string, params: Record<string, string | number> = {}) {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    en[key],
  );
}

export interface SeedStep {
  id: string;
  text: string;
  order: number;
}

export interface SeedRoutine {
  id: string;
  name: string;
  order: number;
  steps: SeedStep[];
  /** Defaults to every day (schemas.ts's own fallback) when omitted. */
  activeDays?: number[];
}

export interface SeedProgress {
  checkedStepIds: string[];
  lastResetDate: string;
}

/**
 * Writes routines/progress straight into IndexedDB before the app boots,
 * bypassing the create/edit UI for tests that aren't exercising that flow.
 * Must run before the first `page.goto` (uses addInitScript) since the page's
 * origin — and so its IndexedDB — isn't reachable before a page has loaded.
 *
 * The DB/store name and version are hand-duplicated from src/lib/idb-store.ts
 * (same reasoning as DATA_KEY above) since an init script runs in the page
 * before any app code and can't import from src/. `page.addInitScript`
 * doesn't wait for this callback's work to finish before navigation
 * proceeds, but in practice the write's `indexedDB.open()` call is scheduled
 * before the app's own (deferred, module-script) first read, so it lands
 * first — this is the standard Playwright pattern for seeding IndexedDB, not
 * a guarantee of the spec.
 */
export async function openSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: en.settings }).click();
}

export async function seedData(
  page: Page,
  routines: SeedRoutine[],
  state: Record<string, SeedProgress> = {},
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      const request = indexedDB.open("routines", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("kv")) {
          request.result.createObjectStore("kv");
        }
      };
      request.onsuccess = () => {
        const transaction = request.result.transaction("kv", "readwrite");
        transaction.objectStore("kv").put(JSON.parse(value), key);
      };
    },
    [DATA_KEY, JSON.stringify({ routines, state })],
  );
}

export function todayIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves once the app-lock enrolment has reached IndexedDB. Settings
 * persist in the background, so a reload right after enrolling can lose
 * it and the app comes back unlocked.
 */
export async function waitForStoredLock(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const request = indexedDB.open("routines");
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
              const read = request.result
                .transaction("kv")
                .objectStore("kv")
                .get("routines-settings");
              read.onerror = () => resolve(false);
              read.onsuccess = () =>
                resolve(
                  Boolean(
                    (read.result as { lock?: unknown } | undefined)?.lock,
                  ),
                );
            };
          }),
      ),
    )
    .toBe(true);
}
