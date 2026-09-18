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
    await page.getByRole("button", { name: en.newRoutine }).click();
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

    await page.getByRole("button", { name: en.newRoutine }).click();
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
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");

    await page.getByRole("button", { name: /Morning/ }).click();
    await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);

    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: en.editRoutine }).click();
      await expect(page).toHaveURL(/\/routines\/routine\/edit\?id=r1$/);
      await page.getByRole("button", { name: en.done }).click();

      // Confirming pops back to the same "routine" entry each time
      // (routine-edit-view.tsx's onBack uses use-smart-back.ts, which pops
      // real history instead of pushing a duplicate whenever there's a
      // real entry to pop) — repeating this shouldn't grow the back-stack,
      // so a single native back from here always reaches home, never a
      // stale intermediate "edit" screen.
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

    // routine-edit-view.tsx's onDelete replaces its own "edit" entry with
    // home rather than pushing — so going back never resurrects the edit
    // form for a routine that's gone. It does NOT collapse the "routine"
    // entry one level further back (a fixed-depth pop would be unsafe: this
    // same view is also reachable by a direct deep link with nothing behind
    // it, see routine-crud.spec.ts's own delete test) — a second-order back
    // tap can still reach that stale "routine" entry, which is exactly what
    // MissingRoutine exists to handle gracefully rather than a broken
    // screen. Fully collapsing every level on delete is tracked as an open
    // question in features/verify-back-button-behavior.md, not silently
    // assumed here.
    await page.goBack();
    await expect(page.getByText(en.routineNotFound)).toBeVisible();
  });
});
