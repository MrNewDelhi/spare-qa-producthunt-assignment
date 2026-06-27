import type { Locator, Page, Response } from "@playwright/test";
import { expect, test } from "@playwright/test";

export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  protected async gotoAndExpectOk(path: string): Promise<Response> {
    const response = await this.page.goto(path);
    this.skipIfCloudflareChallenge(response);
    await this.skipIfChallengePage();
    this.expectOkResponse(response, `document ${path}`);
    if (!response) {
      throw new Error(`Missing document response for ${path}`);
    }
    await expect(this.main()).toBeVisible();
    return response;
  }

  /**
   * Cloudflare bot-management returns 403 to headless browsers on the live
   * site. Treat that as an environment skip (with a clear reason in the report)
   * rather than a misleading red failure. Headed/local runs pass the challenge.
   */
  protected skipIfCloudflareChallenge(response: Response | null): void {
    if (response?.status() === 403) {
      test.skip(
        true,
        "Cloudflare bot challenge (HTTP 403): headless is blocked on the live site. Run headed (PW_HEADLESS=0) or against a non-bot-gated environment / WAF bypass."
      );
    }
  }

  /**
   * Cloudflare sometimes serves the interstitial with a 200 status, so also
   * detect it by page title and skip-with-reason rather than failing red.
   */
  async skipIfChallengePage(): Promise<void> {
    const title = await this.page.title().catch(() => "");
    if (/just a moment|attention required|you have been blocked/i.test(title)) {
      test.skip(true, `Cloudflare challenge page detected ("${title}"). Run headed or against a non-bot-gated environment.`);
    }
  }

  protected async waitForDocumentResponse(urlPattern: RegExp): Promise<Response> {
    const response = await this.page.waitForResponse((candidate) => {
      return candidate.request().resourceType() === "document" && urlPattern.test(candidate.url());
    });
    this.skipIfCloudflareChallenge(response);
    this.expectOkResponse(response, urlPattern.toString());
    return response;
  }

  protected expectOkResponse(response: Response | null, label: string): void {
    expect(response, `${label} response`).not.toBeNull();
    expect(response?.status(), `${label} response status`).toBeLessThan(400);
  }

  protected async expectObservedApiResponsesOk(responses: Response[], label: string): Promise<void> {
    for (const response of responses) {
      expect(response.status(), `${label}: ${response.url()}`).toBeLessThan(500);
    }
  }

  protected async collectImportantResponses<T>(action: () => Promise<T>): Promise<{
    result: T;
    responses: Response[];
  }> {
    const responses: Response[] = [];
    const listener = (response: Response) => {
      const url = response.url();
      if (
        url.includes("/api/") ||
        url.includes("/graphql") ||
        url.includes("/_next/data") ||
        response.request().resourceType() === "fetch" ||
        response.request().resourceType() === "xhr"
      ) {
        responses.push(response);
      }
    };

    this.page.on("response", listener);
    try {
      const result = await action();
      await this.page.waitForLoadState("domcontentloaded");
      return { result, responses };
    } finally {
      this.page.off("response", listener);
    }
  }

  main(): Locator {
    return this.page.locator("main");
  }
}
