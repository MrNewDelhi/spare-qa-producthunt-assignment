import { duplicateElementIds } from "./utils/a11y";
import { bug } from "./utils/annotations";
import { expect, test } from "./fixtures";

const LOST_PAGE = { name: "We seem to have lost this page" };

// ---------------------------------------------------------------------------
// SEO / page semantics
// ---------------------------------------------------------------------------
test.describe("page semantics", { tag: ["@seo", "@a11y"] }, () => {
  for (const path of ["/newsletters", "/apps", "/sponsor", "/stories"]) {
    test(`${path} exposes exactly one page-level h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }

  test(
    "search and submit-product pages expose a single h1",
    { annotation: bug("FE-21", "search landing & /posts/new lack a page-level h1") },
    async ({ page }) => {
      test.fail();
      for (const path of ["/search", "/posts/new"]) {
        await page.goto(path);
        await expect(page.locator("h1")).toHaveCount(1);
      }
    }
  );

  test(
    "forum category pages expose h1 + canonical",
    { annotation: bug("FE-15", "/p/* forum pages lack h1; /p/ai lacks canonical") },
    async ({ page }) => {
      test.fail();
      for (const path of ["/p/general", "/p/ai"]) {
        await page.goto(path);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`));
      }
    }
  );
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------
test.describe("accessibility", { tag: "@a11y" }, () => {
  test("footer social links have accessible names", async ({ page }) => {
    await page.goto("/privacy/do-not-sell");
    await expect(page.locator('footer a[href*="x.com/ProductHunt"]')).toHaveAccessibleName(/Product Hunt|X/i);
    await expect(page.locator('footer a[href*="linkedin.com/company/producthunt"]')).toHaveAccessibleName(/Product Hunt|LinkedIn/i);
  });

  test(
    "public pages do not reuse duplicate element ids",
    { annotation: bug("FE-18", "duplicate SVG ids reused across the page") },
    async ({ page }) => {
      test.fail();
      await page.goto("/categories");
      expect(await duplicateElementIds(page)).toEqual([]);
    }
  );

  test(
    "topics rating radios are labeled",
    { annotation: bug("FE-14", "rating radios lack aria-label/labelledby") },
    async ({ page }) => {
      test.fail();
      await page.goto("/topics");
      await expect(page.locator('input[type="radio"]:not([aria-label]):not([aria-labelledby])')).toHaveCount(0);
    }
  );

  test(
    "products listing image and review links are named",
    { annotation: bug("FE-17", "product image/review links lack accessible names") },
    async ({ page }) => {
      test.fail();
      await page.goto("/products");
      await expect(page.locator('main a[href^="/products/"]').first()).toHaveAccessibleName(/.+/);
      await expect(page.locator('main a[href*="/reviews"]').first()).toHaveAccessibleName(/review/i);
    }
  );

  test("signed-in notification link is named", { annotation: bug("FE-13", "icon-only /notifications link unnamed") }, async ({ page }) => {
    // Requires an authenticated session (the link only renders when signed in).
    test.fixme(true, "Needs an authenticated session / disposable account.");
    await page.goto("/categories");
    await expect(page.locator('a[href="/notifications"]').first()).toHaveAccessibleName(/notifications/i);
  });
});

// ---------------------------------------------------------------------------
// Form flows (POM-driven)
// ---------------------------------------------------------------------------
test.describe("form flows", { tag: ["@flow", "@validation"] }, () => {
  test(
    "sponsor inquiry rejects unsafe company website schemes",
    { tag: "@security", annotation: bug("FE-9", "javascript: company website is accepted and advances the lead form") },
    async ({ page, sponsorPage }) => {
      test.fail();
      await sponsorPage.goto();
      await sponsorPage.getStarted().click();
      await sponsorPage.fillStepOne({
        name: "QA Security Test",
        email: "qa-security-test@example.com",
        company: "QA Test Co",
        website: "javascript:alert(1)"
      });
      await sponsorPage.continue().click();
      // Desired: stay on step 1 with a URL error. Bug: it advances to step 2.
      await expect(page.getByText(/STEP 2 OF 4/i)).toHaveCount(0);
    }
  );

  test(
    "sponsor inquiry exposes semantic validation state",
    { annotation: bug("FE-10", "validation errors are visual-only (no aria-invalid/role=alert)") },
    async ({ page, sponsorPage }) => {
      test.fail();
      await sponsorPage.goto();
      await sponsorPage.getStarted().click();
      await sponsorPage.continue().click();
      await expect(page.locator('[role="alert"], [aria-invalid="true"]')).not.toHaveCount(0);
    }
  );

  test(
    "newsletter signup uses native email semantics",
    { annotation: bug("FE-11", "newsletter email field is type=text without semantic invalid state") },
    async ({ newsletterPage }) => {
      test.fail();
      await newsletterPage.goto();
      await expect(newsletterPage.emailInput()).toHaveAttribute("type", "email");
    }
  );
});

// ---------------------------------------------------------------------------
// Routing / resilience
// ---------------------------------------------------------------------------
test.describe("routing", { tag: ["@resilience", "@seo"] }, () => {
  test("daily leaderboard date URLs canonicalize", async ({ page }) => {
    await page.goto("/leaderboard/daily/2026/06/26");
    await expect(page).toHaveURL(/\/leaderboard\/daily\/2026\/6\/26$/);
  });

  test("search invalid page values normalize to page one", async ({ page }) => {
    for (const path of ["/search?q=ai&page=0", "/search?q=ai&page=-5", "/search?q=ai&page=abc"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "500" })).toHaveCount(0);
    }
  });

  test(
    "weekly and monthly leaderboard base routes resolve",
    { annotation: bug("FE-16", "/leaderboard/weekly and /monthly base routes 404") },
    async ({ page }) => {
      test.fail();
      for (const path of ["/leaderboard/weekly", "/leaderboard/monthly"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", LOST_PAGE)).toHaveCount(0);
      }
    }
  );

  test(
    "yearly and all-time leaderboard routes resolve",
    { annotation: bug("FE-19", "leaderboard route variants 404 / fail to canonicalize") },
    async ({ page }) => {
      test.fail();
      for (const path of ["/leaderboard/yearly", "/leaderboard/all-time"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", LOST_PAGE)).toHaveCount(0);
      }
    }
  );
});
