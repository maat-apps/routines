import { chromium, test } from "@playwright/test";
import { playAudit } from "playwright-lighthouse";

// playwright-lighthouse needs a browser it launched itself with a fixed
// remote-debugging port (Lighthouse drives Chrome over the CDP port
// directly) — the test runner's own managed `page`/`browser` fixtures don't
// expose one, so this test launches its own browser rather than using them.
// Categories exclude "pwa": playAudit's own defaults still list it, but
// Lighthouse removed the PWA category outright in a more recent major
// version than this (unmaintained since 2024) package's defaults assume —
// passing those defaults through unchanged throws "unrecognized category in
// 'onlyCategories': pwa" before a report is even produced.
const DEBUG_PORT = 9223;

// Baseline run against the built home screen (2026-09-18): performance 96,
// accessibility 100, best-practices 100, seo 100. Thresholds below give
// performance real slack (timing-based, the one category actually prone to
// shared-runner flakiness per this task's own notes) while keeping the
// three deterministic categories at the baseline they already clear.
const THRESHOLDS = {
  performance: 85,
  accessibility: 100,
  "best-practices": 100,
  seo: 100,
};

test("lighthouse audit of the home screen meets its score thresholds", async () => {
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${DEBUG_PORT}`],
  });
  const page = await browser.newPage();

  try {
    await page.goto("http://localhost:4173/routines/");
    await playAudit({
      page,
      port: DEBUG_PORT,
      thresholds: THRESHOLDS,
      reports: {
        formats: { html: true, json: true },
        name: "lighthouse-home",
        directory: "lighthouse-report",
      },
    });
  } finally {
    await browser.close();
  }
});
