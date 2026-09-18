import { expect, test } from "@playwright/test";

import { en, pl, seedData } from "./utils";

test.describe("settings", () => {
  test("switching language updates the visible label", async ({ page }) => {
    await seedData(page, []);
    await page.goto("");
    await page.getByRole("button", { name: en.settings }).click();

    const dialog = page.getByRole("dialog");
    const languageTrigger = page.getByRole("combobox", {
      name: en.language,
    });
    await languageTrigger.click();
    // "Polski"/"English" are literal option labels (each language name shown
    // in its own language), not sourced from en.json/pl.json — not a
    // hardcoded-translation gap the same way the rest of this suite had.
    await page.getByRole("option", { name: "Polski" }).click();

    // The combobox's own aria-label is itself the translated word for
    // "Language" (becomes "Język" once the locale switches), so match its
    // displayed value directly rather than the ambiguous, locale-dependent
    // accessible name.
    await expect(page.locator('[data-slot="select-value"]')).toHaveText(
      "Polski",
    );
    // Not just the select's own value: confirm already-rendered UI outside
    // the select actually re-rendered too — the settings drawer's own
    // title, and the home screen underneath it (still mounted behind the
    // drawer, not replaced by it). A bug that updates the stored locale and
    // the select but misses re-rendering other already-mounted text (a
    // stale closure, a missed t() call) wouldn't be caught by the select
    // check alone.
    await expect(
      dialog.getByRole("heading", { name: pl.settings }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: pl.appName })).toBeVisible();
  });

  test("reset settings clears preferences but leaves routine data alone", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");
    await page.getByRole("button", { name: en.settings }).click();

    await page.getByRole("button", { name: en.resetSettings }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.resetSettingsTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: en.resetSettingsAction }).click();

    await page.waitForURL(/\/routines\/?$/);
    const remainingKeys = await page.evaluate(() =>
      Object.keys(window.localStorage),
    );
    // routines-settings (app lock) is never auto-recreated, but
    // routines-locale is — the locale store's first-launch detection
    // re-writes a freshly-detected value on this same reload, so its
    // presence afterward is correct behavior, not a leftover preference.
    expect(remainingKeys).not.toContain("routines-settings");
    expect(remainingKeys).toContain("routines-data");
    await expect(page.getByRole("button", { name: /Morning/ })).toBeVisible();
  });
});
