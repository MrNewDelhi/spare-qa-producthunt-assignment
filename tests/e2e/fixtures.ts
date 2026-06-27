import { test as base } from "@playwright/test";
import { AuthModalPage } from "./pages/auth.page";
import { HomePage } from "./pages/home.page";
import { LeaderboardPage } from "./pages/leaderboard.page";
import { NavigationPage } from "./pages/navigation.page";
import { NewsletterPage } from "./pages/newsletter.page";
import { ProductPage } from "./pages/product.page";
import { SearchPage } from "./pages/search.page";
import { SponsorInquiryPage } from "./pages/sponsor.page";

type Fixtures = {
  consoleErrors: string[];
  homePage: HomePage;
  navigationPage: NavigationPage;
  productPage: ProductPage;
  searchPage: SearchPage;
  leaderboardPage: LeaderboardPage;
  authModalPage: AuthModalPage;
  sponsorPage: SponsorInquiryPage;
  newsletterPage: NewsletterPage;
};

export const test = base.extend<Fixtures>({
  // Collects browser console errors and attaches them to the HTML report so a
  // failure carries its own diagnostics instead of needing a re-run.
  consoleErrors: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await use(errors);
    if (errors.length > 0) {
      await testInfo.attach("console-errors", {
        body: errors.join("\n"),
        contentType: "text/plain"
      });
    }
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  navigationPage: async ({ page }, use) => {
    await use(new NavigationPage(page));
  },
  productPage: async ({ page }, use) => {
    await use(new ProductPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
  leaderboardPage: async ({ page }, use) => {
    await use(new LeaderboardPage(page));
  },
  authModalPage: async ({ page }, use) => {
    await use(new AuthModalPage(page));
  },
  sponsorPage: async ({ page }, use) => {
    await use(new SponsorInquiryPage(page));
  },
  newsletterPage: async ({ page }, use) => {
    await use(new NewsletterPage(page));
  }
});

export { expect } from "@playwright/test";
