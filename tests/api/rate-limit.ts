import { apiUrl, hasToken } from "../../src/lib/graphql-client";

export type RateLimitStatus = { limited: boolean; reason: string };

// One-time, memoized probe of the token's rate-limit budget.
//
// The Product Hunt token enforces a 15-minute, complexity-based budget
// (`x-rate-limit-*`). A run that STARTS already over budget — a re-run inside
// the same window, or a shared/parallel CI token — would otherwise produce a
// misleading cascade of "expected 200, received 429" failures that look like
// API contract regressions but are purely environmental.
//
// We detect that once, up front, and let token-gated tests skip-with-reason
// instead of failing red — the same philosophy as the E2E Cloudflare guard.
// A single cheap `{ __typename }` request is memoized for the whole process.
let cached: Promise<RateLimitStatus> | undefined;

export function rateLimitStatus(): Promise<RateLimitStatus> {
  if (!cached) {
    cached = probe();
  }
  return cached;
}

async function probe(): Promise<RateLimitStatus> {
  // Escape hatch for demos / verifying the skip path without burning budget.
  if (process.env.PH_FORCE_RATE_LIMIT_SKIP === "1") {
    return { limited: true, reason: "forced via PH_FORCE_RATE_LIMIT_SKIP=1" };
  }

  if (!hasToken()) {
    // No token: token tests already skip for a different (documented) reason.
    return { limited: false, reason: "" };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PH_API_TOKEN}`
      },
      body: JSON.stringify({ query: "{ __typename }" })
    });

    const remaining = Number(response.headers.get("x-rate-limit-remaining"));
    const reset = response.headers.get("x-rate-limit-reset") ?? "?";

    if (response.status === 429 || (Number.isFinite(remaining) && remaining <= 0)) {
      return {
        limited: true,
        reason: `rate limited: HTTP ${response.status}, remaining=${remaining}, reset in ${reset}s — run once per 15-min window with a dedicated token`
      };
    }

    return { limited: false, reason: "" };
  } catch {
    // A probe failure must not block the suite; let the real tests report.
    return { limited: false, reason: "" };
  }
}
