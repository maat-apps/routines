import { expect, test } from "@playwright/test";

import { en, openSettings, seedData } from "./utils";

test.describe("thumb layout", () => {
  test("puts the next step at the bottom and groups finished ones on top", async ({
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
    await page.goto("");
    await openSettings(page);
    await page.getByRole("switch", { name: en.thumbLayout }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Morning/ }).click();

    const stretch = page.getByRole("checkbox", { name: "Stretch" });
    const coffee = page.getByRole("checkbox", { name: "Coffee" });
    const stretchBox = await stretch.boundingBox();
    const coffeeBox = await coffee.boundingBox();
    expect(stretchBox!.y).toBeGreaterThan(coffeeBox!.y);

    await stretch.click();
    await expect(stretch).toHaveCount(0);
    await page.getByRole("button", { name: new RegExp(en.doneSteps) }).click();
    await expect(stretch).toHaveAttribute("aria-checked", "true");
  });
});
