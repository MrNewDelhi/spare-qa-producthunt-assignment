import { bug } from "./utils/annotations";
import { expect, test } from "./fixtures";

test("direct search renders results and preserves the query", { tag: ["@core", "@smoke"] }, async ({ searchPage }) => {
  await test.step("open a direct search URL", async () => {
    await searchPage.goto("notion");
  });

  await test.step("assert query persistence and visible results", async () => {
    await expect(searchPage.searchInput()).toHaveValue("notion");
    await expect(searchPage.resultButtons().first()).toBeVisible();
  });
});

test(
  "search result products expose anchor (link) semantics",
  { tag: ["@a11y", "@seo"], annotation: bug("FE-8", "search results are <button>, not <a> — not crawlable / no open-in-new-tab") },
  async ({ searchPage }) => {
    // Known defect: results render as buttons, so there are no product anchors.
    test.fail();
    await searchPage.goto("notion");
    await expect(searchPage.resultLinks().first()).toBeVisible();
  }
);

test("search pagination advances to page 2", { tag: "@core" }, async ({ page, searchPage }) => {
  await test.step("open first page of search results", async () => {
    await searchPage.goto("notion");
  });

  await test.step("advance using pagination and wait for navigation", async () => {
    await searchPage.goToNextPage("notion");
  });

  await test.step("assert page 2 URL state", async () => {
    await expect(page).toHaveURL(/\/search\?q=notion&page=2/);
  });
});

test(
  "out-of-range search pagination does not render a server error",
  { tag: ["@resilience"], annotation: bug("FE-1", "large ?page value returns HTTP 500 instead of empty state/404") },
  async ({ page, searchPage }) => {
    // Known defect: page=10000 currently 500s. Expected-to-fail until fixed.
    test.fail();
    const response = await searchPage.gotoOutOfRange("notion", 10000);
    expect(response?.status(), "out-of-range page should not 5xx").toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "500" })).toHaveCount(0);
  }
);
