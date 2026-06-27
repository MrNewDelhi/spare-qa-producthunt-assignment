import { describe, expect, test } from "bun:test";
import { requirePosts, tokenTest } from "./helpers";
import { ProductHuntApi } from "./product-hunt-api";

describe("Product Hunt assignment API core suite", () => {
  const api = new ProductHuntApi();

  test("rejects missing bearer token", async () => {
    const response = await api.queryWithoutToken();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.errors[0].error).toBe("invalid_oauth_token");
  });

  test("rejects invalid bearer token", async () => {
    const response = await api.queryWithInvalidToken();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].error).toBe("invalid_oauth_token");
  });

  tokenTest("posts returns a typed connection", async () => {
    const posts = await requirePosts(5);

    expect(posts.pageInfo.endCursor.length).toBeGreaterThan(0);
    expect(typeof posts.pageInfo.hasNextPage).toBe("boolean");
    for (const edge of posts.edges) {
      expect(edge.node.id).toMatch(/^\d+$/);
      expect(edge.node.name.length).toBeGreaterThan(0);
      expect(typeof edge.node.votesCount).toBe("number");
    }
  });

  tokenTest("cursor pagination returns distinct pages", async () => {
    const firstPage = await requirePosts(5);
    const secondPage = await api.posts(5, firstPage.pageInfo.endCursor);

    expect(secondPage.status).toBe(200);
    const pageOneIds = new Set(firstPage.edges.map((edge) => edge.node.id));
    const pageTwoIds = secondPage.data?.posts.edges.map((edge) => edge.node.id) ?? [];

    expect(pageTwoIds.length).toBe(5);
    for (const id of pageTwoIds) {
      expect(pageOneIds.has(id)).toBe(false);
    }
  });

  tokenTest("invalid field returns a validation error, not a server error", async () => {
    const response = await api.invalidPostField();
    const message = response.errors?.[0]?.message ?? "";

    expect(response.status).toBe(200);
    expect(message).toContain("notARealField");
    expect(message).not.toMatch(/stack|trace|\/app\/|graphql-ruby/i);
  });

  // KNOWN DEFECT (see docs/findings.md): a non-string `query` value should be a
  // client error (4xx), but the GraphQL endpoint currently returns 500. Marked
  // `failing` so the suite stays green while tracking the regression contract.
  tokenTest.failing("non-string query values are rejected as client errors, not 500s", async () => {
    const response = await api.nonStringQueryPayload(123);

    // Desired contract: a validation / bad-request status. Asserting the exact
    // 4xx set (not a loose <500) so a 429 rate-limit response can't satisfy it
    // and silently invert this `failing` guard.
    expect([400, 422]).toContain(response.status);
  });
});
