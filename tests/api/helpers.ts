import { expect, test } from "bun:test";
import { gql, hasToken } from "../../src/lib/graphql-client";
import { rateLimitStatus } from "./rate-limit";

// Resolved once before any test registers (memoized in rate-limit.ts), so a
// token that is already over budget skips token tests with a clear reason
// instead of producing a misleading red cascade of 429s.
const rateLimit = await rateLimitStatus();

function tokenTestImpl(name: string, fn: () => Promise<void>): void {
  if (!hasToken()) {
    test.skip(name, fn);
    return;
  }
  if (rateLimit.limited) {
    test.skip(`${name} [skipped: ${rateLimit.reason}]`, fn);
    return;
  }

  test(name, fn);
}

/**
 * Token-gated test that documents a known product defect: the assertions encode
 * the *desired* contract, the live API currently violates it, so we mark it
 * `failing`. The suite stays green, but if Product Hunt fixes the behaviour the
 * test flips red to tell us the assertion must be promoted to a normal test.
 */
function tokenTestFailing(name: string, fn: () => Promise<void>): void {
  if (!hasToken()) {
    test.skip(name, fn);
    return;
  }
  if (rateLimit.limited) {
    test.skip(`${name} [skipped: ${rateLimit.reason}]`, fn);
    return;
  }

  test.failing(name, fn);
}

export const tokenTest = Object.assign(tokenTestImpl, { failing: tokenTestFailing });

export function expectNoServerError(status: number): void {
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(500);
}

export async function requirePosts(first = 5) {
  const response = await gql<{
    posts: {
      edges: Array<{ node: { id: string; name: string; slug: string; votesCount: number } }>;
      pageInfo: { endCursor: string; hasNextPage: boolean };
    };
  }>(`
    query Posts($first: Int!) {
      posts(first: $first) {
        edges { node { id name slug votesCount } }
        pageInfo { endCursor hasNextPage }
      }
    }
  `, { first });

  expect(response.status).toBe(200);
  expect(response.errors).toBeUndefined();
  expect(response.data?.posts.edges.length).toBe(first);
  if (!response.data) {
    throw new Error("expected posts response data");
  }
  return response.data.posts;
}
