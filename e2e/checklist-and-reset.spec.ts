import { expect, test } from "@playwright/test";

import { en, seedData, todayIso } from "./utils";

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
      page.getByRole("img", { name: `1 / 2 ${en.completed}` }),
    ).toBeVisible();

    // Toggling back off works the same way.
    await step.click();
    await expect(step).toHaveAttribute("aria-checked", "false");
  });

  test("a seeded partial checked state renders correctly on load, without any interaction", async ({
    page,
  }) => {
    await seedData(
      page,
      [
        {
          id: "r1",
          name: "Morning",
          order: 0,
          steps: [
            { id: "s1", text: "Stretch", order: 0 },
            { id: "s2", text: "Coffee", order: 1 },
          ],
        },
      ],
      { r1: { checkedStepIds: ["s1"], lastResetDate: todayIso() } },
    );

    // Home list's compact ProgressRing reflects the seeded state too — a
    // separate render path from the detail view's, not exercised by
    // seeding a single-step, all-or-nothing routine the way the other
    // tests in this file do.
    await page.goto("");
    await expect(
      page.getByRole("img", { name: `1 / 2 ${en.completed}` }),
    ).toBeVisible();

    await page.goto("routine?id=r1");
    await expect(
      page.getByRole("checkbox", { name: "Stretch" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("checkbox", { name: "Coffee" }),
    ).toHaveAttribute("aria-checked", "false");
    await expect(
      page.getByRole("img", { name: `1 / 2 ${en.completed}` }),
    ).toBeVisible();
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

    await page.getByRole("button", { name: en.reset }).click();
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
