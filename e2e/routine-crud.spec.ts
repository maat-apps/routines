import { expect, test } from "@playwright/test";

import { en, seedData, t } from "./fixtures";

test.describe("create / edit / reorder / delete a routine", () => {
  test("creates a routine with two steps end to end", async ({ page }) => {
    await seedData(page, []);
    await page.goto("");
    // Two "New routine" buttons exist when the list is empty: the
    // always-present floating action button and the empty state's own —
    // either works identically here.
    await page.getByRole("button", { name: en.newRoutine }).first().click();

    await page.getByLabel(en.routineName).fill("Evening");
    await page.getByRole("button", { name: en.addStep }).click();
    await page.getByLabel(t("stepNumber", { number: 1 })).fill("Brush teeth");
    // Enter on a step commits it and focuses a newly-inserted row below.
    // Unlike Escape (see backup.spec.ts), this is representative of a real
    // phone: a virtual keyboard's Return/Next key dispatches a genuine
    // Enter keydown on a focused text input on both Android and iOS.
    await page.getByLabel(t("stepNumber", { number: 1 })).press("Enter");
    await page.getByLabel(t("stepNumber", { number: 2 })).fill("Read");

    const done = page.getByRole("button", { name: en.done });
    await expect(done).toBeEnabled();
    await done.click();

    await expect(page).toHaveURL(/\/routines\/routine\?id=.+/);
    await expect(page.getByRole("heading", { name: "Evening" })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Brush teeth" }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Read" })).toBeVisible();
  });

  test("Done stays disabled until a name and a non-empty step exist", async ({
    page,
  }) => {
    await seedData(page, []);
    await page.goto("new");
    const done = page.getByRole("button", { name: en.done });
    await expect(done).toBeDisabled();

    await page.getByLabel(en.routineName).fill("Evening");
    await expect(done).toBeDisabled();

    await page.getByRole("button", { name: en.addStep }).click();
    await expect(done).toBeDisabled();

    await page.getByLabel(t("stepNumber", { number: 1 })).fill("Brush teeth");
    await expect(done).toBeEnabled();
  });

  test("edits an existing routine's name and steps", async ({ page }) => {
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
    await page.goto("routine/edit?id=r1");

    await page.getByLabel(en.routineName).fill("Morning routine");
    await page.getByRole("button", { name: en.deleteStep }).first().click();
    await page.getByRole("button", { name: en.done }).click();

    await expect(page).toHaveURL(/\/routines\/routine\?id=r1$/);
    await expect(
      page.getByRole("heading", { name: "Morning routine" }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Stretch" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("checkbox", { name: "Coffee" })).toBeVisible();
  });

  test("deletes a routine from the edit view", async ({ page }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("routine/edit?id=r1");
    await page.getByRole("button", { name: en.deleteRoutine }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.deleteRoutineTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: en.deleteRoutine }).click();

    await expect(page).toHaveURL(/\/routines\/?$/);
    await expect(page.getByText(en.emptyTitle)).toBeVisible();
  });

  test("reorders steps by dragging a step's handle past the next one", async ({
    page,
  }) => {
    await seedData(page, [
      {
        id: "r1",
        name: "Morning",
        order: 0,
        steps: [
          { id: "s1", text: "First", order: 0 },
          { id: "s2", text: "Second", order: 1 },
        ],
      },
    ]);
    await page.goto("routine/edit?id=r1");

    const handles = page.getByRole("button", { name: en.dragStep });
    const firstHandleBox = await handles.nth(0).boundingBox();
    const secondHandleBox = await handles.nth(1).boundingBox();
    if (!firstHandleBox || !secondHandleBox) {
      throw new Error("step drag handles not found");
    }

    await page.mouse.move(
      firstHandleBox.x + firstHandleBox.width / 2,
      firstHandleBox.y + firstHandleBox.height / 2,
    );
    await page.mouse.down();
    // dnd-kit's PointerSensor needs to see real movement past its activation
    // distance before it starts a drag — a single jump won't register.
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const y =
        firstHandleBox.y +
        ((secondHandleBox.y + secondHandleBox.height + 10 - firstHandleBox.y) *
          i) /
          steps;
      await page.mouse.move(firstHandleBox.x + firstHandleBox.width / 2, y);
    }
    await page.mouse.up();

    // stepNumber's template ("Step {number}") has a locale-dependent prefix
    // too — derive it instead of hand-copying "Step " into the selector.
    const stepLabelPrefix = en.stepNumber.split("{number}")[0];
    const stepInputs = page.locator(`input[aria-label^="${stepLabelPrefix}"]`);
    await expect(stepInputs.nth(0)).toHaveValue("Second");
    await expect(stepInputs.nth(1)).toHaveValue("First");
  });
});
