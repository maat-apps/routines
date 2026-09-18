import { expect, test } from "@playwright/test";

import { en, seedData, swipeDown } from "./fixtures";

test.describe("drawer dismissal", () => {
  test("swiping down on the swipe handle closes the settings drawer", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("");
    await page.getByRole("button", { name: en.settings }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // CLAUDE.md: Base UI's drawer reacts to real touch gestures, not
    // synthetic mouse drags — drive raw CDP touch events over the drawer's
    // body, from just under its grab handle down past the viewport edge.
    const box = await dialog.boundingBox();
    if (!box) throw new Error("settings drawer not found");
    await swipeDown(page, box.x + box.width / 2, box.y + 20, box.y + 500);

    await expect(dialog).toHaveCount(0);
  });

  test("the browser back gesture closes the topmost drawer instead of navigating away", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");
    await page.getByRole("button", { name: en.settings }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Still on the home screen — back closed the drawer, it didn't leave the route.
    await expect(page).toHaveURL(/\/routines\/$/);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
  });
});
