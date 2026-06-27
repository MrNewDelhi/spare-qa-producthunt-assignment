import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<Response> {
    return this.gotoAndExpectOk("/");
  }

  heading(): Locator {
    return this.page.getByRole("heading", { name: "Top Products Launching Today" });
  }

  productLinks(): Locator {
    return this.page.locator('main a[href^="/products/"]');
  }

  searchTrigger(): Locator {
    return this.page.locator('[data-test="header-search-input"], input[placeholder*="Search"]').first();
  }
}
