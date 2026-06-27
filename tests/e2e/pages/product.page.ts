import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";
import { HomePage } from "./home.page";

export class ProductPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openFirstProductFromHome(): Promise<Response> {
    const home = new HomePage(this.page);
    await home.goto();

    // Page objects act; tests assert. This is an internal precondition guard
    // (not a test assertion), so it throws rather than using expect().
    const firstProductHref = await home.productLinks().first().getAttribute("href");
    if (!firstProductHref?.startsWith("/products/")) {
      throw new Error(`expected a /products/ href from the launch feed, got: ${firstProductHref}`);
    }

    return this.gotoAndExpectOk(firstProductHref);
  }

  productHeading(): Locator {
    return this.page.locator("main h1").first();
  }
}
