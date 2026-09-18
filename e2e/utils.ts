import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Page } from "@playwright/test";

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
}

export interface SeedProgress {
  checkedStepIds: string[];
  lastResetDate: string;
}

/**
 * Writes routines/progress straight into localStorage before the app boots,
 * bypassing the create/edit UI for tests that aren't exercising that flow.
 * Must run before the first `page.goto` (uses addInitScript) since
 * localStorage isn't reachable before a page has loaded some origin.
 */
export async function seedData(
  page: Page,
  routines: SeedRoutine[],
  state: Record<string, SeedProgress> = {},
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
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
 * Base UI's drawer swipe-to-dismiss reacts to real touch events, not
 * synthetic mouse drags (see CLAUDE.md's Drawer notes) — Playwright has no
 * high-level touch-drag API, so this drives the CDP Input domain directly.
 *
 * The per-step delay matters, not just the path: firing all touchmove
 * events back-to-back (no delay) let the gesture's distance/velocity
 * tracking depend on incidental IPC round-trip jitter between CDP calls to
 * produce a plausible touch cadence — fine on a fast machine, but flaky on
 * a slower/busier CI runner, where that jitter isn't consistent enough to
 * reliably cross the drawer's dismiss threshold (observed: this test
 * failed the same way, same assertion, on two consecutive CI runs before
 * this fix). A fixed ~16ms delay between steps (roughly one frame at 60Hz)
 * gives it a realistic, consistent cadence instead of relying on chance.
 */
export async function swipeDown(
  page: Page,
  x: number,
  startY: number,
  endY: number,
  steps = 8,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  const point = (y: number) => [{ x, y, id: 1 }];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(startY),
  });

  for (let i = 1; i <= steps; i++) {
    const y = startY + ((endY - startY) * i) / steps;
    await wait(16);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(y),
    });
  }

  await wait(16);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
