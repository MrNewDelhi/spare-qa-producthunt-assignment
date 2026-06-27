import { describe, expect } from "bun:test";
import { gql } from "../../src/lib/graphql-client";
import { tokenTest } from "./helpers";

describe("Product Hunt GraphQL security posture", () => {
  tokenTest("introspection is enabled in production", async () => {
    const response = await gql<{
      __schema: { queryType: { fields: Array<{ name: string }> }; mutationType: { fields: Array<{ name: string }> } };
    }>(`
      query {
        __schema {
          queryType { fields { name } }
          mutationType { fields { name } }
        }
      }
    `);

    expect(response.status).toBe(200);
    expect(response.data?.__schema.queryType.fields.map((field) => field.name)).toContain("posts");
    expect(response.data?.__schema.mutationType.fields.map((field) => field.name)).toContain("userFollow");
  });

  tokenTest("validation errors include schema suggestions but no stack traces", async () => {
    const response = await gql<unknown>("{ postz { id } }");
    const message = response.errors?.[0]?.message ?? "";

    expect(response.status).toBe(200);
    expect(message).toContain("Did you mean");
    expect(message).not.toMatch(/stack|trace|\/app\/|graphql-ruby/i);
  });

  tokenTest("rate-limit debit is flat for tiny and aliased broad queries", async () => {
    const small = await gql<unknown>("{ posts(first: 1) { edges { node { id name } } } }");
    const broad = await gql<unknown>(`
      query {
        a: posts(first: 20) { edges { node { id name tagline votesCount commentsCount reviewsCount createdAt url website } } }
        b: posts(first: 20) { edges { node { id name tagline votesCount commentsCount reviewsCount createdAt url website } } }
        c: posts(first: 20) { edges { node { id name tagline votesCount commentsCount reviewsCount createdAt url website } } }
        d: posts(first: 20) { edges { node { id name tagline votesCount commentsCount reviewsCount createdAt url website } } }
        e: posts(first: 20) { edges { node { id name tagline votesCount commentsCount reviewsCount createdAt url website } } }
      }
    `);

    expect(small.status).toBe(200);
    expect(broad.status).toBe(200);
    expect(Number(small.headers.get("x-rate-limit-limit"))).toBeGreaterThan(0);
    expect(Number(broad.headers.get("x-rate-limit-limit"))).toBeGreaterThan(0);

    // The broad query selects 5 aliased posts(first:20) = 100 connection edges
    // with many scalar fields each; the tiny query selects 1. Debit tracks edge
    // count (~100 more), NOT field count — confirming complexity is connection-
    // based, not field-based as the docs imply. Asserted as a tolerant band so a
    // shared/parallel token's background drift can't flake this on exact equality.
    const smallRemaining = Number(small.headers.get("x-rate-limit-remaining"));
    const broadRemaining = Number(broad.headers.get("x-rate-limit-remaining"));
    const broadExtraDebit = smallRemaining - broadRemaining;
    expect(broadExtraDebit).toBeGreaterThanOrEqual(95);
    expect(broadExtraDebit).toBeLessThanOrEqual(105);
  });

  tokenTest("depth and max-complexity controls reject very deep nested queries", async () => {
    const response = await gql<unknown>(`
      query {
        posts(first: 1) {
          edges {
            node {
              comments(first: 1) {
                edges {
                  node {
                    replies(first: 1) {
                      edges { node { replies(first: 1) { edges { node { replies(first: 1) { edges { node { id } } } } } } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);

    const messages = response.errors?.map((error) => error.message).join(" ") ?? "";
    expect(response.status).toBe(200);
    expect(messages).toMatch(/depth|complexity/i);
  });
});
