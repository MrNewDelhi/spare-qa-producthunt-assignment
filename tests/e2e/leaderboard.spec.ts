import { expect, test } from "./fixtures";

test("daily launches leaderboard renders ranked content and the archive", { tag: ["@core", "@flow"] }, async ({ page, leaderboardPage }) => {
  await test.step("open the most recent daily leaderboard", async () => {
    await leaderboardPage.gotoMostRecent();
  });

  await test.step("assert the board rendered with content and the archive", async () => {
    await expect(page).toHaveTitle(/Product Hunt/);
    await expect(leaderboardPage.archive()).toBeVisible();
    expect(await leaderboardPage.contentLinks().count()).toBeGreaterThan(5);
  });
});
