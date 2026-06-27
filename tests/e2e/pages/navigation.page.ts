import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";

export type MainNavigationTarget = {
  name: string;
  pathPattern: RegExp;
};

export class NavigationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoHome(): Promise<Response> {
    return this.gotoAndExpectOk("/");
  }

  navLink(name: string): Locator {
    // Scope to the header's "Main Navigation" so we don't collide with the same
    // link text in the footer / sidebar (e.g. "News" appears 3× page-wide).
    return this.page.getByRole("navigation", { name: "Main Navigation" }).getByRole("link", { name });
  }

  /** Header banner is present on every page — a robust "page loaded" signal. */
  banner(): Locator {
    return this.page.getByRole("banner");
  }

  async openMainNavigationTarget(target: MainNavigationTarget): Promise<Response> {
    const [response] = await Promise.all([
      this.waitForDocumentResponse(target.pathPattern),
      this.navLink(target.name).click()
    ]);
    // A CF challenge on the destination should skip-with-reason, not fail red.
    this.skipIfCloudflareChallenge(response);
    return response;
  }
}
