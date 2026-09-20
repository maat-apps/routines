import { expect, test } from "@playwright/test";

import { en, seedData } from "./utils";

test.describe("all routines view", () => {
  test("reached from Settings, lists every routine including ones hidden from home today", async ({
    page,
  }) => {
    const today = new Date().getDay();
    const notToday = (today + 1) % 7;
    await seedData(page, [
      { id: "r1", name: "Today", order: 0, activeDays: [today], steps: [] },
      {
        id: "r2",
        name: "Someday",
        order: 1,
        activeDays: [notToday],
        steps: [],
      },
    ]);
    await page.goto("");

    // "Someday" isn't scheduled today, so it's absent from home's own list.
    await expect(page.getByRole("button", { name: /Today/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Someday/ })).toHaveCount(0);

    await page.getByRole("button", { name: en.settings }).click();
    await page.getByRole("button", { name: en.viewAllRoutinesAction }).click();

    await expect(page).toHaveURL(/\/routines\/all-routines$/);
    await expect(
      page.getByRole("heading", { name: en.allRoutinesTitle }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Today/ })).toBeVisible();
    const someday = page.getByRole("button", { name: /Someday/ });
    await expect(someday).toBeVisible();
    await expect(someday.getByText(en.notScheduledToday)).toBeVisible();
    // The scheduled-today routine has no such tag.
    await expect(
      page
        .getByRole("button", { name: /Today/ })
        .getByText(en.notScheduledToday),
    ).toHaveCount(0);
  });

  test("opening a routine from here goes to its detail view", async ({
    page,
  }) => {
    const notToday = (new Date().getDay() + 1) % 7;
    await seedData(page, [
      {
        id: "r1",
        name: "Someday",
        order: 0,
        activeDays: [notToday],
        steps: [{ id: "s1", text: "Stretch", order: 0 }],
      },
    ]);
    await page.goto("all-routines");

    await page.getByRole("button", { name: /Someday/ }).click();
    await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);
    await expect(page.getByRole("heading", { name: "Someday" })).toBeVisible();
  });

  test("shows the create-a-routine empty state when there are none at all", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("all-routines");

    await expect(page.getByText(en.emptyTitle)).toBeVisible();
    await page.getByRole("button", { name: en.newRoutine }).click();
    await expect(page).toHaveURL(/\/routines\/new$/);
  });

  test("back button returns to home", async ({ page }) => {
    await seedData(page, []);
    await page.goto("all-routines");

    await page.getByRole("button", { name: en.back }).click();
    await expect(page).toHaveURL(/\/routines\/?$/);
  });

  test("an unknown routine id offers a way to reach this view", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("routine?id=missing");
    await expect(page.getByText(en.routineNotFound)).toBeVisible();

    await page.getByRole("button", { name: en.viewAllRoutines }).click();
    await expect(page).toHaveURL(/\/routines\/all-routines$/);
    await expect(page.getByRole("button", { name: /Morning/ })).toBeVisible();
  });
});
