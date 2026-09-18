import { expect, test } from "@playwright/test";

import { en, seedData } from "./fixtures";

test.describe("route navigation", () => {
  test("moves between home, new, and routine view with correct URLs and no blank screen", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");
    await expect(page).toHaveURL(/\/routines\/?$/);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();

    // Home -> new routine. The app bar (a landmark shared across screens)
    // should stay meaningfully present rather than the page going blank
    // mid-transition (the startTransition + idle-prefetch change this
    // suite exists to guard, per the task's own motivation).
    await page.getByRole("button", { name: en.newRoutine }).click();
    await expect(page).toHaveURL(/\/routines\/new$/);
    await expect(
      page.getByRole("heading", { name: en.newRoutineTitle }),
    ).toBeVisible();

    await page.getByRole("button", { name: en.back }).click();
    await expect(page).toHaveURL(/\/routines\/?$/);

    // Home -> existing routine -> edit -> back lands on the routine, not home.
    // The row's accessible name also folds in its ProgressRing's aria-label
    // ("Morning 0 / 0 completed"), so match a substring rather than the
    // exact routine name.
    await page.getByRole("button", { name: /Morning/ }).click();
    await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);
    await expect(page.getByRole("heading", { name: "Morning" })).toBeVisible();

    await page.getByRole("button", { name: en.editRoutine }).click();
    await expect(page).toHaveURL(/\/routines\/routine\/edit\?id=r1$/);
    await expect(
      page.getByRole("heading", { name: en.editTitle }),
    ).toBeVisible();

    await page.getByRole("button", { name: en.back }).click();
    await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);
  });

  test("deep link into a routine works on a fresh navigation (hard refresh)", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("routine?id=r1");
    await expect(page.getByRole("heading", { name: "Morning" })).toBeVisible();
  });

  test("an unknown routine id shows the missing-routine fallback", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("routine?id=missing");
    await expect(page.getByText(en.routineNotFound)).toBeVisible();
    await page.getByRole("button", { name: en.viewAllRoutines }).click();
    await expect(page).toHaveURL(/\/routines\/?$/);
  });
});
