import type { Page } from "@playwright/test";

/** IDs that appear more than once in the live DOM (invalid HTML / a11y hazard). */
export async function duplicateElementIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const counts = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[id]"))) {
      const id = el.id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, n]) => n > 1)
      .map(([id]) => id);
  });
}
