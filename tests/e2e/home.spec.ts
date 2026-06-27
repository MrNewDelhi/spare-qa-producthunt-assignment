import { bug } from "./utils/annotations";
import { expect, test } from "./fixtures";

test("home page loads and the launch feed renders", { tag: ["@core", "@smoke"] }, async ({ page, homePage }) => {
  await test.step("open the Product Hunt launch feed", async () => {
    await homePage.goto();
  });

  await test.step("assert core discovery content is visible", async () => {
    await expect(homePage.heading()).toBeVisible();
    await expect(homePage.productLinks().first()).toBeVisible();
    await expect(page).toHaveTitle(/Product Hunt/);
  });
});

test("decorative promoted pixels are not announced as product content", { tag: "@a11y" }, async ({ page }) => {
  await page.goto("/");
  const promotedPixels = await page.locator('main img[alt="Promoted"][width="1"][height="1"]').count();
  expect(promotedPixels).toBe(0);
});

test(
  "home page emits no console errors",
  { tag: ["@resilience"], annotation: [bug("FE-6", "manifest.json 403"), bug("FE-7", "Google FedCM/GSI NetworkError")] },
  async ({ page, consoleErrors }) => {
    // Known product defect: home currently logs manifest 403 + FedCM errors.
    // `test.fail` keeps the suite green while the bug is open and flips it red
    // the moment the console is clean again (prompting removal of this marker).
    test.fail();
    await page.goto("/");
    await page.waitForLoadState("load");
    expect(consoleErrors).toEqual([]);
  }
);
