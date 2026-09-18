import { expect, test } from "@playwright/test";

import { seedData, todayIso } from "./fixtures";

test.describe("checking off steps and resetting", () => {
  test("checking a step updates its state and the progress ring", async ({
    page,
  }) => {
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
    await page.goto("routine?id=r1");

    const step = page.getByRole("checkbox", { name: "Stretch" });
    await expect(step).toHaveAttribute("aria-checked", "false");
    await step.click();
    await expect(step).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("img", { name: "1 / 2 completed" }),
    ).toBeVisible();

    // Toggling back off works the same way.
    await step.click();
    await expect(step).toHaveAttribute("aria-checked", "false");
  });

  test("the routine's Reset button clears all checked steps", async ({
    page,
  }) => {
    await seedData(
      page,
      [
        {
          id: "r1",
          name: "Morning",
          order: 0,
          steps: [{ id: "s1", text: "Stretch", order: 0 }],
        },
      ],
      { r1: { checkedStepIds: ["s1"], lastResetDate: todayIso() } },
    );
    await page.goto("routine?id=r1");

    const step = page.getByRole("checkbox", { name: "Stretch" });
    await expect(step).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(step).toHaveAttribute("aria-checked", "false");
  });

  test("a stale lastResetDate is cleared automatically on load (daily reset)", async ({
    page,
  }) => {
    await seedData(
      page,
      [
        {
          id: "r1",
          name: "Morning",
          order: 0,
          steps: [{ id: "s1", text: "Stretch", order: 0 }],
        },
      ],
      // Yesterday's progress should not survive a fresh read today.
      { r1: { checkedStepIds: ["s1"], lastResetDate: "2000-01-01" } },
    );
    await page.goto("routine?id=r1");

    await expect(
      page.getByRole("checkbox", { name: "Stretch" }),
    ).toHaveAttribute("aria-checked", "false");
  });
});
