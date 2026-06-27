import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";

export class SearchPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(query: string, pageNumber?: number): Promise<Response> {
    const params = new URLSearchParams({ q: query });
    if (pageNumber) {
      params.set("page", String(pageNumber));
    }
    return this.gotoAndExpectOk(`/search?${params.toString()}`);
  }

  searchInput(): Locator {
    return this.page.getByRole("textbox", { name: "Search" });
  }

  resultButtons(): Locator {
    return this.page.locator("main button").filter({ has: this.page.locator("img") });
  }

  resultLinks(): Locator {
    return this.page.locator('main a[href^="/products/"]');
  }

  nextLink(): Locator {
    return this.page.getByRole("link", { name: "Next" });
  }

  async goToNextPage(query: string): Promise<Response> {
    const [response] = await Promise.all([
      this.waitForDocumentResponse(new RegExp(`/search\\?q=${encodeURIComponent(query)}&page=2`)),
      this.nextLink().click()
    ]);
    return response;
  }

  async gotoOutOfRange(query: string, pageNumber: number): Promise<Response | null> {
    const response = await this.page.goto(`/search?q=${encodeURIComponent(query)}&page=${pageNumber}`);
    this.skipIfCloudflareChallenge(response);
    return response;
  }
}
