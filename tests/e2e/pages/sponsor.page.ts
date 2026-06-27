import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";

/** Multi-step advertiser/sponsor inquiry form (lead capture). */
export class SponsorInquiryPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<Response> {
    return this.gotoAndExpectOk("/sponsor/inquiry");
  }

  getStarted(): Locator {
    return this.page.getByRole("button", { name: /Get started/i });
  }

  field(name: string | RegExp): Locator {
    return this.page.getByLabel(name);
  }

  companyWebsite(): Locator {
    return this.page.getByLabel(/Company website/i);
  }

  continue(): Locator {
    return this.page.getByRole("button", { name: /Continue/i });
  }

  stepIndicator(): Locator {
    return this.page.getByText(/STEP \d+ OF \d+/i);
  }

  /** Fill the step-1 lead fields with safe placeholder values (no submit). */
  async fillStepOne(values: { name: string; email: string; company: string; website: string }): Promise<void> {
    await this.field(/Name/i).fill(values.name);
    await this.field(/Email/i).fill(values.email);
    await this.field(/Company/i).first().fill(values.company);
    await this.companyWebsite().fill(values.website);
  }
}
