import { expect, test } from "./fixtures";

test("a product detail page renders from the launch feed", { tag: ["@core", "@smoke"] }, async ({ page, productPage }) => {
  await test.step("open first product from the launch feed", async () => {
    await productPage.openFirstProductFromHome();
  });

  await test.step("assert product detail route and heading", async () => {
    await expect(page).toHaveURL(/\/products\//);
    await expect(productPage.productHeading()).toBeVisible();
  });
});
