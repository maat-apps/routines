import { expect, type Page, test } from "@playwright/test";

import { en, seedData } from "./utils";

test.describe("route navigation", () => {
  test("home to new routine and back with no blank screen", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("");
    await expect(page).toHaveURL(/\/routines\/?$/);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();

    // The app bar (a landmark shared across screens) should stay
    // meaningfully present rather than the page going blank mid-transition
    // (the startTransition + idle-prefetch change this suite exists to
    // guard, per the task's own motivation).
    // Two "New routine" buttons exist when the list is empty (the FAB and
    // the empty state's own) — either works identically here.
    await page.getByRole("button", { name: en.newRoutine }).first().click();
    await expect(page).toHaveURL(/\/routines\/new$/);
    await expect(
      page.getByRole("heading", { name: en.newRoutineTitle }),
    ).toBeVisible();

    await page.getByRole("button", { name: en.back }).click();
    await expect(page).toHaveURL(/\/routines\/?$/);
  });

  test("existing routine: edit then back lands on the routine, not home", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");

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

test.describe("native back button", () => {
  async function fillMinimalRoutine(page: Page) {
    await page.getByLabel(en.routineName).fill("Evening");
    await page.getByRole("button", { name: en.addStep }).click();
    await page.getByPlaceholder(en.addStepPlaceholder).fill("Brush teeth");
  }

  test("creating a routine then going back lands on home, not the blank draft", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("");

    await page.getByRole("button", { name: en.newRoutine }).first().click();
    await expect(page).toHaveURL(/\/routines\/new$/);
    await fillMinimalRoutine(page);
    await page.getByRole("button", { name: en.done }).click();

    // Done navigates to the new routine's own detail view, replacing the
    // draft's "/new" entry — not the blank "new routine" form the draft
    // came from (see new-routine-view.tsx's onComplete).
    await expect(page).toHaveURL(/\/routines\/routine\?id=.+$/);
    await expect(page.getByRole("heading", { name: "Evening" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/routines\/?$/);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
  });

  test("editing and confirming an existing routine, twice, then going back lands on home", async ({
    page,
  }) => {
    await seedData(page, [
      {
        id: "r1",
        name: "Morning",
        order: 0,
        steps: [{ id: "s1", text: "Stretch", order: 0 }],
      },
    ]);
    await page.goto("");

    await page.getByRole("button", { name: /Morning/ }).click();
    await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);

    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: en.editRoutine }).click();
      await expect(page).toHaveURL(/\/routines\/routine\/edit\?id=r1$/);
      await page.getByRole("button", { name: en.done }).click();

      // Confirming pops back to the same "routine" entry each time
      // (use-smart-back.ts) instead of pushing a duplicate, so repeating
      // this doesn't grow the back-stack.
      await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);
      await expect(
        page.getByRole("heading", { name: "Morning" }),
      ).toBeVisible();
    }

    await page.goBack();
    await expect(page).toHaveURL(/\/routines\/?$/);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
  });

  test("deleting a routine redirects to home, and its stale edit entry is never resurrected by going back", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");

    await page.getByRole("button", { name: /Morning/ }).click();
    await page.getByRole("button", { name: en.editRoutine }).click();
    await page.getByRole("button", { name: en.deleteRoutine }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.deleteRoutineTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: en.deleteRoutine }).click();

    await expect(page).toHaveURL(/\/routines\/?$/);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();

    // Going back once from home never resurrects the edit form for a
    // routine that's gone — it can still reach the stale "routine" entry
    // one level further back, which MissingRoutine handles gracefully.
    // Fully collapsing that level too needs real navigation-depth tracking,
    // not a fixed-depth navigate(-N) (see routine-edit-view.tsx's onDelete) —
    // accepted as a deliberate, tested trade-off rather than a silent gap.
    await page.goBack();
    await expect(page.getByText(en.routineNotFound)).toBeVisible();
  });
});
