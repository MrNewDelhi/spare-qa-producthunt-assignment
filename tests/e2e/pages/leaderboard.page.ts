import type { Locator, Page, Response } from "@playwright/test";
import { BasePage } from "./base.page";

/** Daily/weekly/monthly "Launches" leaderboard + Launch Archive. */
export class LeaderboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async gotoDaily(year: number, month: number, day: number): Promise<Response> {
    return this.gotoAndExpectOk(`/leaderboard/daily/${year}/${month}/${day}`);
  }

  /** Most recent *completed* day (yesterday UTC) — today's board can be sparse early. */
  async gotoMostRecent(): Promise<Response> {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.gotoDaily(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  /** Ranked launch entries (cards link to products or posts). */
  rankedEntries(): Locator {
    return this.page.locator('main a[href^="/products/"], main a[href^="/posts/"]');
  }

  /** Any in-content link — a tolerant "the board rendered" signal. */
  contentLinks(): Locator {
    return this.page.locator("main a");
  }

  /**
   * The "Launch Archive" heading inside the leaderboard content. Scoped to
   * <main> on purpose: the header nav also renders a "Launch archive" link
   * outside <main>, so an unscoped getByText hits a strict-mode violation.
   */
  archive(): Locator {
    return this.page.locator("main").getByText("Launch Archive", { exact: false });
  }
}
