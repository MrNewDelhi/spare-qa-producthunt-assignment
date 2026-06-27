import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Sign-in / sign-up modal (a major flow). Opened from the header trigger.
 * Read-only: we never submit credentials — we only assert the modal contract.
 */
export class AuthModalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  signInTrigger(): Locator {
    return this.page.getByTestId("header-nav-link-sign-in");
  }

  async open(): Promise<void> {
    await this.gotoAndExpectOk("/");
    await this.signInTrigger().click();
    await this.heading().waitFor({ state: "visible" });
  }

  /** Modal container scoped via its heading's nearest dialog/region. */
  heading(): Locator {
    return this.page.getByRole("heading", { name: /Sign (up|in) on Product Hunt/i });
  }

  closeButton(): Locator {
    // The dismiss control is an aria-labelled element, not a <button> role.
    return this.page.locator('[aria-label="Close"]').first();
  }

  providerButton(provider: "Linkedin" | "Github" | "X"): Locator {
    return this.page.getByRole("button", { name: `Sign in with ${provider}` });
  }

  /** Every button rendered inside the auth modal (used for a11y name checks). */
  allModalButtons(): Locator {
    // Buttons that live in the modal layer (after the banner, before <main>).
    return this.page.getByRole("button").filter({ hasNot: this.page.locator("nav button") });
  }
}
