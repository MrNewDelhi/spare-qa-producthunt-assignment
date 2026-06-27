import { describe, expect, test } from "bun:test";
import { apiUrl, rawGraphqlRequest } from "../../src/lib/graphql-client";

const simpleQuery = "{ posts(first: 1) { edges { node { id name } } } }";

describe("Product Hunt GraphQL auth contract", () => {
  test("rejects missing bearer token with stable OAuth-style JSON", async () => {
    const response = await rawGraphqlRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: simpleQuery })
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.errors[0].error).toBe("invalid_oauth_token");
    expect(body.errors[0].message).toBeUndefined();
  });

  test("rejects invalid bearer token with the same public contract", async () => {
    const response = await rawGraphqlRequest({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid_token_for_contract_test"
      },
      body: JSON.stringify({ query: simpleQuery })
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].error).toBe("invalid_oauth_token");
  });

  test("rejects missing query body before auth without leaking internals", async () => {
    const response = await rawGraphqlRequest({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("query_missing");
    expect(text).not.toMatch(/stack|trace|\/app\/|rails|graphql-ruby/i);
  });

  test("documents method/CORS mismatch for unsupported GET", async () => {
    const response = await fetch(`${apiUrl}?query=${encodeURIComponent("{ __typename }")}`, {
      method: "GET"
    });

    expect(response.status).not.toBe(200);
    expect(response.headers.get("content-type") ?? "").not.toContain("application/json");
  });
});
