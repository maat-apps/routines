import { expect, test } from "@playwright/test";

import { en, openSettings, seedData } from "./utils";

test.describe("thumb layout", () => {
  test("checks the bottom card by swiping right and sends it to the end by swiping left", async ({
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
          { id: "s3", text: "Shower", order: 2 },
        ],
      },
    ]);
    await page.goto("");
    await openSettings(page);
    await page.getByRole("switch", { name: en.thumbLayout }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Morning/ }).click();

    const stretch = page.getByRole("group", { name: "Stretch" });
    await expect(stretch).toBeVisible();
    await stretch.focus();
    await page.keyboard.press("ArrowLeft");

    const coffee = page.getByRole("group", { name: "Coffee" });
    await expect(coffee).toBeVisible();
    await coffee.focus();
    await page.keyboard.press("ArrowRight");

    const shower = page.getByRole("group", { name: "Shower" });
    await expect(shower).toBeVisible();
    await shower.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("group", { name: "Stretch" })).toBeVisible();
    await expect(page.getByText("Coffee")).toHaveCount(0);
  });

  test("undoes the last swipe", async ({ page }) => {
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
    await page.goto("");
    await openSettings(page);
    await page.getByRole("switch", { name: en.thumbLayout }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Morning/ }).click();

    const undo = page.getByRole("button", { name: en.undo });
    await expect(undo).toBeDisabled();

    await page.getByRole("group", { name: "Stretch" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("group", { name: "Coffee" })).toBeVisible();

    await undo.click();
    await expect(page.getByRole("group", { name: "Stretch" })).toBeVisible();
    await expect(undo).toBeDisabled();
  });
});
