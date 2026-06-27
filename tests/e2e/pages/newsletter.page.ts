import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";

/** Newsletter subscribe surface. Read-only: we inspect semantics, never finalise a real subscription. */
export class NewsletterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<Response> {
    return this.gotoAndExpectOk("/newsletters");
  }

  emailInput(): Locator {
    return this.page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  }
}
