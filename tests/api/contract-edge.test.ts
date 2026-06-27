import { describe, expect } from "bun:test";
import { apiUrl, rawGraphqlRequest } from "../../src/lib/graphql-client";
import { tokenTest } from "./helpers";

const simpleQuery = "{ posts(first: 1) { edges { node { id } } } }";

function authedHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.PH_API_TOKEN}`,
    "Content-Type": "application/json"
  };
}

// Defect-guard suite: every test below encodes a *desired* API contract that
// the live Product Hunt GraphQL endpoint currently violates (500s on malformed
// input, permissive CORS/HEAD handling — see docs/findings.md). They are marked
// `tokenTest.failing` so the suite stays green while the defects exist and flips
// red the moment any of them is fixed, prompting promotion to a normal test.
describe("Product Hunt GraphQL parser and method edge cases", () => {
  tokenTest.failing("rejects non-string query values as client errors, not 500s", async () => {
    for (const query of [123, true, { x: 1 }, [simpleQuery]]) {
      const response = await rawGraphqlRequest({
        method: "POST",
        headers: authedHeaders(),
        body: JSON.stringify({ query })
      });

      // Exact 4xx set (not loose <500) so a 429 can't satisfy this guard.
      expect([400, 422]).toContain(response.status);
      expect(response.headers.get("content-type") ?? "").toContain("application/json");
    }
  });

  tokenTest.failing("rejects non-object variables as client errors, not 500s", async () => {
    for (const variables of [[1], 1]) {
      const response = await rawGraphqlRequest({
        method: "POST",
        headers: authedHeaders(),
        body: JSON.stringify({
          query: "query($n:Int){ posts(first:$n){ edges{ node{ id } } } }",
          variables
        })
      });

      // Exact 4xx set (not loose <500) so a 429 can't satisfy this guard.
      expect([400, 422]).toContain(response.status);
    }
  });

  tokenTest.failing("does not execute a document when operationName is unknown", async () => {
    const response = await rawGraphqlRequest({
      method: "POST",
      headers: authedHeaders(),
      body: JSON.stringify({
        query: "query A { posts(first:1){ edges{ node{ id } } } }",
        operationName: "B"
      })
    });
    const body = await response.json();

    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.message ?? "").toMatch(/operation/i);
  });

  tokenTest.failing("malformed JSON returns a JSON error envelope", async () => {
    const response = await rawGraphqlRequest({
      method: "POST",
      headers: authedHeaders(),
      body: '{"query":'
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    expect(await response.text()).toMatch(/error|message/i);
  });

  tokenTest.failing("CORS does not allow arbitrary origins with Authorization", async () => {
    const response = await rawGraphqlRequest({
      method: "OPTIONS",
      headers: {
        Authorization: `Bearer ${process.env.PH_API_TOKEN}`,
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type"
      }
    });

    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
  });

  tokenTest.failing("advertised HEAD method is supported or not advertised", async () => {
    const response = await fetch(apiUrl, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${process.env.PH_API_TOKEN}` }
    });

    expect(response.status).not.toBe(404);
    expect(response.headers.get("content-type") ?? "").not.toContain("text/html");
  });
});
