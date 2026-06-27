import { expect, test } from "./fixtures";

test("sign-in modal opens with named social providers", { tag: ["@core", "@flow", "@auth"] }, async ({ authModalPage }) => {
  await test.step("open the sign-in modal from the header", async () => {
    await authModalPage.open();
  });

  await test.step("assert modal contract (heading + named providers)", async () => {
    await expect(authModalPage.heading()).toBeVisible();
    await expect(authModalPage.providerButton("Linkedin")).toBeVisible();
    await expect(authModalPage.providerButton("Github")).toBeVisible();
    await expect(authModalPage.providerButton("X")).toBeVisible();
  });
});
