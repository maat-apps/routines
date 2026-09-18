import { expect, test } from "@playwright/test";

import { en, seedData, swipeDown } from "./utils";

test.describe("drawer dismissal", () => {
  test("swiping down on the swipe handle closes the settings drawer", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("");
    await page.getByRole("button", { name: en.settings }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The drawer's open transition is a 450ms CSS transform (see
    // drawer.tsx's `duration-450` popup class); `toBeVisible()` only proves
    // the dialog is in the DOM and painted, not that it's finished sliding
    // in. Reading boundingBox() mid-slide can put startY below the still-
    // arriving drawer's real on-screen position, so `canStart`'s
    // point-inside-popup check (useSwipeDismiss.js) silently rejects the
    // touchstart and the whole gesture never begins — the swipe API itself
    // has no bearing on this, since the gesture is never even recognized.
    // Wait for the transition to finish so the box we measure is final.
    await dialog.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    );

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
