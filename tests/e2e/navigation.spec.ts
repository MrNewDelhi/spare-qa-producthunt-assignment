import { expect, test } from "./fixtures";
import type { MainNavigationTarget } from "./pages/navigation.page";

const navCases: MainNavigationTarget[] = [
  { name: "Best Products", pathPattern: /\/categories/ },
  { name: "Launches", pathPattern: /\/leaderboard\/daily/ },
  { name: "News", pathPattern: /\/newsletters/ },
  { name: "Forums", pathPattern: /\/forums/ }
];

// Two representative destinations carry @core to keep the default suite at the
// assignment-sized 8 scenarios; the full set runs under @nav (extended).
const coreNav = new Set(["Launches", "Forums"]);

for (const navCase of navCases) {
  const tag = coreNav.has(navCase.name) ? ["@core", "@nav"] : ["@nav"];
  test(`main navigation opens ${navCase.name}`, { tag }, async ({ page, navigationPage }) => {
    await test.step("open the anonymous home page", async () => {
      await navigationPage.gotoHome();
    });

    await test.step(`navigate to ${navCase.name}`, async () => {
      await navigationPage.openMainNavigationTarget(navCase);
    });

    await test.step("assert destination page loaded", async () => {
      await navigationPage.skipIfChallengePage();
      await expect(page).toHaveURL(navCase.pathPattern);
      // Not every destination uses a <main> landmark; the header banner is a
      // reliable cross-page "loaded" signal.
      await expect(navigationPage.banner()).toBeVisible();
    });
  });
}
