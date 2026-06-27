import type { Locator, Page, Response } from "@playwright/test";
import { expect } from "@playwright/test";
import { BasePage } from "./base.page";
import { HomePage } from "./home.page";

export class ProductPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openFirstProductFromHome(): Promise<Response> {
    const home = new HomePage(this.page);
    await home.goto();

    const firstProductHref = await home.productLinks().first().getAttribute("href");
    expect(firstProductHref).toMatch(/^\/products\//);

    return this.gotoAndExpectOk(firstProductHref ?? "");
  }

  productHeading(): Locator {
    return this.page.locator("main h1").first();
  }
}
