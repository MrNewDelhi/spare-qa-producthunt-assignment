# Security Assessment - Product Hunt Web and GraphQL API

Scope: read-only, low-volume probes against the public web app, public GraphQL API, and official API starter repo. No mutation, DoS/load testing, brute force, or private-data access was attempted. Date: 2026-06-27 IST.

## Executive Summary

No account takeover or direct private-data exposure was found in this passive assessment. Product Hunt has strong web security headers, Cloudflare/WAF protection, HSTS, `nosniff`, and GraphQL depth/max-complexity controls.

The strongest security-relevant findings are around developer/API trust:

- The official OAuth starter app omits `state` and stores a signed Product Hunt access token in a readable cookie without hardened flags.
- The official starter proxy drops upstream API HTTP status and rate-limit headers.
- The official sample dependency stack is stale enough to carry high/critical audit findings.
- The sponsor inquiry form accepts `javascript:` as the company website and advances the lead form, creating stored unsafe-URL risk for downstream sales/admin tooling.
- The login page carries untrusted external `origin` values into OAuth provider handoff URLs; callback behavior still needs authenticated validation.
- GraphQL broad aliasing appears to consume the same rate-limit debit as a tiny query, creating an amplification gap versus the documented field-based complexity model.
- GraphQL introspection and field suggestions expose the full production schema.
- GraphQL parser/contract edge cases return server errors or surprising success for malformed `query`, `variables`, and `operationName` inputs.
- API contract inconsistencies make client security/error handling harder: OAuth-style 401 errors, HTML 404 for GET, and missing rate-limit headers on unauthenticated errors.

## Confirmed Findings

### S1 - Official OAuth sample omits `state`

- Severity: High
- Evidence: `routes/authorize.js` builds the authorization URL without a `state` parameter; `routes/callback.js` exchanges `req.query.code` without validating state.
- Impact: developers copying the official sample can ship OAuth CSRF / authorization-code injection risk.
- Recommended fix: add random state generation, store state in server-side session or hardened cookie, and validate before token exchange.

### S2 - Official sample stores access token in a readable cookie

- Severity: High
- Evidence: `routes/callback.js` uses `jwt.sign(accessToken, SECRET)`, then `res.cookie("nekot_htua", authToken)` without `HttpOnly`, `Secure`, or `SameSite`. README describes this as "encrypted", but JWT signing is not encryption.
- Impact: any XSS/third-party script compromise can read the cookie and recover the bearer token from the JWT payload. Missing flags also weaken transport and CSRF posture.
- Recommended fix: keep access tokens server-side; put only opaque session ids in `HttpOnly; Secure; SameSite=Lax/Strict` cookies.

### S3 - GraphQL complexity/rate debit is flat for broad aliasing

- Severity: Medium
- Evidence: a small `posts(first:1)` query and a broad five-alias `posts(first:20)` query both decremented `x-rate-limit-remaining` by 100. The broad response body was tens of KB larger.
- Impact: a client can retrieve significantly more data per point than the docs imply. This matters for scraping and fairness, especially combined with public voter/user relationships.
- Boundary: a deeply nested query was rejected by depth and complexity controls, so vertical amplification is controlled.
- Automated guard: `tests/api/security.test.ts`.

### S3b - Official starter proxy masks upstream API status and headers

- Severity: High
- Evidence: the starter's `routes/graphql.js` calls upstream Product Hunt GraphQL, then returns `res.json(await response.json())` without forwarding upstream status, `x-rate-limit-*`, or 401/429 semantics.
- Impact: developers copying the sample cannot observe rate limits correctly and may treat upstream auth/rate failures as normal HTTP 200 app responses.
- Recommended fix: forward upstream status, selected response headers, and a stable error envelope.

### S4 - Introspection and field suggestions disclose schema details

- Severity: Low/Medium
- Evidence: `{ __schema { ... } }` returns query fields, mutation fields, object types, and deprecated fields. Invalid fields return `Did you mean ...` suggestions.
- Impact: exposes the full attack surface and undocumented fields. Lower severity because docs are public, but still relevant for production hardening and schema drift.
- Automated guard: `tests/api/security.test.ts`.

### S5 - Auth/error contract is inconsistent

- Severity: Medium
- Evidence: missing/invalid bearer token returns `HTTP 401` with `errors[0].error = invalid_oauth_token`, not GraphQL `errors[0].message`. A malformed empty body returns pre-auth `HTTP 400 query_missing`.
- Impact: clients must handle multiple error formats and cannot distinguish missing vs invalid tokens.
- Automated guard: `tests/api/auth.test.ts`.

### S6 - CORS and HTTP method contract are inconsistent

- Severity: Low
- Evidence: preflight advertises `GET, POST, HEAD, OPTIONS`, but GET with a GraphQL query returns an HTML 404 instead of JSON/405. Authenticated API responses expose `x-rate-limit-*`; unauthenticated 400/401 responses do not, despite docs implying each response includes them.
- Impact: browser/API clients receive a surprising contract; docs should clarify server-to-server expectations and supported methods.

### S7 - Public relationship data is enumerable

- Severity: Low/Medium
- Evidence: `votes(first:N)` exposes voter user ids/names/usernames for posts; `user(id:"1")`, `user(id:"2")`, etc. expose public profiles. Open issues ask about upvoter visibility.
- Impact: likely public-by-design, but enables bulk profiling/scraping when combined with weak alias costing. Product should confirm intended privacy posture and rate-cost these relationships appropriately.

### S8 - Official sample dependency stack is stale

- Severity: High
- Evidence: public manifests use old `jsonwebtoken`, `isomorphic-fetch`/`node-fetch`, `react-scripts 2.1.8`, React 16, and old tooling. A subagent-generated temporary audit from public manifests found high/critical vulnerability counts.
- Impact: the official starter is a developer-facing security example; stale dependencies and no obvious lockfile/audit posture teach unsafe defaults.
- Recommended fix: refresh to supported Node LTS and maintained dependencies, add lockfiles, Dependabot, CI audit, and a `SECURITY.md`.

### S9 - Sponsor inquiry accepts unsafe URL schemes

- Severity: Medium/High
- Evidence: on `/sponsor/inquiry`, step 1 accepted `javascript:alert(1)` in the Company website field and advanced to `STEP 2 OF 4 - LAUNCH` without error. The launch URL field on step 2 rejected the same scheme, so the validation gap is field-specific.
- Impact: unsafe schemes can be stored in advertiser lead records and later rendered or clicked from sales/admin tools, CRM notes, notification emails, exports, or analytics dashboards.
- Recommended fix: enforce an allow-list of `https:` and optionally `http:` URLs on both client and server, normalize before storage, and add CRM/admin rendering tests.

### S10 - Login origin is propagated into OAuth handoff without same-origin validation

- Severity: Medium candidate
- Evidence: `/login?origin=https://evil.example.com/ph-test` generated provider form actions that preserved the external origin parameter for LinkedIn, GitHub, X, Google, Facebook, and Apple. Protocol-relative `//evil.example.com/ph-test` was also preserved.
- Impact: if any post-provider callback trusts the carried origin, this can become a post-login open redirect or phishing primitive.
- Boundary: callback completion was not tested to avoid account/linking side effects. Validate with a disposable account or staging environment by completing one provider callback and confirming the final redirect is same-origin only.
- Recommended fix: accept only relative paths or allow-listed same-origin URLs before provider handoff; reject or replace external origins at login entry.

### S11 - GraphQL parser edge cases return 500s or fail open

- Severity: Medium
- Evidence: authenticated read-only probes showed non-string `query` values and non-object `variables` can return HTTP 500 `SERVER_ERROR`; unknown `operationName` is ignored for a single-operation document; malformed JSON returns an empty HTML 400.
- Impact: client input bugs create server-error noise, quota confusion, and potentially execute an unintended operation.
- Recommended fix: validate request body shape before GraphQL execution; reject unknown `operationName`; standardize JSON parser errors.

## Positive Controls

- Web headers include a strict CSP, HSTS with preload, COOP/COEP/CORP, locked permissions policy, `X-Frame-Options: SAMEORIGIN`, and `x-content-type-options: nosniff`.
- Cloudflare/WAF blocked a basic reflected-XSS search payload.
- Newsletter invalid-email testing did not reflect a malicious HTML payload as HTML or text.
- GraphQL has per-response `x-request-id`.
- Deep nested GraphQL probes are rejected by max depth and max complexity.
- Invalid product slugs return a controlled 404.

## Out of Scope

Write mutations such as `userFollow`, publishing malicious forum comments, OAuth account-linking with a real user session, private-scope data checks beyond safe introspection, load/stress testing, token brute force, and broad scraping.

## Security Tests Implemented

| Test file | Coverage |
|---|---|
| `tests/api/auth.test.ts` | no token, invalid token, missing query body, unsupported GET |
| `tests/api/security.test.ts` | introspection, field suggestions, flat alias rate debit, depth/complexity rejection |
| `tests/api/pagination.test.ts` | invalid cursor behavior |
| `tests/api/contract-edge.test.ts` | malformed query/variables, operationName, malformed JSON, CORS, HEAD contract |
| `tests/e2e/search.spec.ts` | public 500 guard for out-of-range search |
| `tests/e2e/public-pages.spec.ts` | sponsor unsafe URL validation and public form accessibility guards |

## Recommended Remediation Order

1. Fix the official OAuth sample: state validation, server-side token storage, hardened cookies, least-privilege default scopes.
2. Preserve upstream status/rate-limit headers in the official starter proxy.
3. Refresh the official starter dependency stack and add disclosure/audit hygiene.
4. Reject unsafe URL schemes in sponsor/advertiser lead forms and validate downstream rendering in admin/CRM surfaces.
5. Same-origin validate login `origin` before OAuth provider handoff.
6. Reconcile GraphQL complexity accounting with aliases, breadth, connection counts, and validation errors.
7. Return validation errors for invalid cursors and invalid `first` values.
8. Standardize API error shape and document which responses include rate-limit headers.
9. Decide and document production introspection posture.
