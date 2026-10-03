import { expect, test } from "@playwright/test";

import { en, openSettings, seedData } from "./utils";

test.describe("thumb layout", () => {
  test("shows steps as swipeable cards and moves to the next one after a tap", async ({
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

    const stretch = page.getByRole("checkbox", { name: "Stretch" });
    const coffee = page.getByRole("checkbox", { name: "Coffee" });
    await expect(stretch).toBeInViewport({ ratio: 1 });

    await stretch.click();
    await expect(stretch).toHaveAttribute("aria-checked", "true");
    await expect(coffee).toBeInViewport({ ratio: 1 });
  });
});
