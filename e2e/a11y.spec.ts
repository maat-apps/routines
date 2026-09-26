import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { openSettings, seedData } from "./utils";

// Zero violations against WCAG 2.0/2.1 A+AA, scanned per screen rather than
// once for the whole app — a violation's exact location (which screen, which
// node) is the whole point of using axe over a single Lighthouse score.
// wcag22aa pulls in the "target-size" rule (WCAG 2.5.8, min 24x24 CSS px) —
// worth including given the task's own note flagging icon-button hit areas
// (28-36px) as a maybe against a 44px UX guideline; this is the closest
// thing to an automated check for that.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Every test asserts a heading (or the dialog, for the drawer case) is
// visible before auditing — page.goto() only waits for the network load
// event, not React actually settling, and scanning too early can let a
// real violation slip through undetected rather than flag it (see the
// disabledRules use below: that's exactly how one went unnoticed).
async function auditIsClean(page: Page, disabledRules: string[] = []) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .disableRules(disabledRules)
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

test.describe("accessibility (axe-core)", () => {
  test("home screen has no violations", async ({ page }) => {
    await seedData(page, [
      {
        id: "r1",
        name: "Morning",
        order: 0,
        steps: [{ id: "s1", text: "Stretch", order: 0 }],
      },
    ]);
    await page.goto("");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await auditIsClean(page);
  });

  test("home's empty state has no violations", async ({ page }) => {
    await seedData(page, []);
    await page.goto("");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await auditIsClean(page);
  });

  test("routine detail screen has no violations", async ({ page }) => {
    await seedData(page, [
      {
        id: "r1",
        name: "Morning",
        order: 0,
        steps: [
          { id: "s1", text: "Stretch", order: 0 },
          { id: "s2", text: "Coffee", order: 1 },
        ],
      },
    ]);
    await page.goto("r1");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await auditIsClean(page);
  });

  test("routine edit screen has no violations", async ({ page }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("r1/edit");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await auditIsClean(page);
  });

  test("the settings drawer has no violations while open", async ({ page }) => {
    await seedData(page, []);
    await page.goto("");
    await openSettings(page);
    await expect(page.getByRole("dialog")).toBeVisible();
    await auditIsClean(page);
  });

  test("the all-routines screen has no violations", async ({ page }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("all-routines");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await auditIsClean(page);
  });
});
