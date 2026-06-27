import { expect, test } from "bun:test";
import { hasToken } from "../../src/lib/graphql-client";

// Guards against the "green but empty" trap: token tests skip when PH_API_TOKEN
// is absent (good DX for forks/reviewers), but CI must fail loudly so we never
// ship a passing run that silently skipped the authenticated coverage.
test("PH_API_TOKEN is present in CI (token-gated suite actually runs)", () => {
  if (process.env.CI) {
    expect(hasToken()).toBe(true);
  } else {
    // Local/fork without a token is allowed; token tests skip by design.
    expect(typeof hasToken()).toBe("boolean");
  }
});
