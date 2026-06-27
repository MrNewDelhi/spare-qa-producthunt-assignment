# 10 Major Testing Scenarios for Product Hunt

These are the ten scenarios I would present as the core assignment answer. They are framed as product risks and test coverage areas, not only as bugs. The split keeps the submission balanced: five frontend user journeys and five API/security contracts.

## Frontend Scenarios

### 1. Anonymous Home Feed Discovery
- **Risk covered:** Product Hunt's main value is discovery. If the launch feed, product links, or page semantics break, anonymous users cannot evaluate the product.
- **Flow:** Open the home page, verify the primary heading, confirm launch cards render, follow the first product, and assert the product detail page has a stable title/tagline.
- **Expected result:** Home renders without fatal client errors, product links are navigable, and the product detail route exposes meaningful content.
- **Automation fit:** Playwright E2E, high priority, anonymous, stable enough for CI.

### 2. Search and Search Result Navigation
- **Risk covered:** Search is a core intent path for users comparing tools. It also touches query handling and URL state.
- **Flow:** Use the header search, search for a known broad term such as `notion`, verify the query is preserved in the URL, confirm results render, and open a result.
- **Expected result:** Search returns results, keeps the search term visible, result interactions behave like navigation, and no broken/empty state appears for common terms.
- **Automation fit:** Playwright E2E with structural assertions rather than exact product names.

### 3. Search Pagination and Invalid Page Recovery
- **Risk covered:** Pagination is easy to overlook but can create severe production errors and bad SEO if route parameters are not bounded.
- **Flow:** Start on `/search?q=notion`, move to page 2, then manually visit high/invalid page values such as `page=10000`.
- **Expected result:** Valid pagination updates the URL and controls correctly. Invalid or out-of-range pages should render a graceful empty state, redirect, or 404, not a 500.
- **Automation fit:** Playwright E2E. The out-of-range case is a defect guard and should be tracked separately from the happy-path pagination test.

### 4. Public Navigation and SEO-Critical Routes
- **Risk covered:** Product Hunt relies on discovery from public navigation, search engines, and shared links. Broken public routes reduce trust and acquisition.
- **Flow:** Validate top navigation entries such as Launches, Best Products, News, Forums, Products, Topics, and Leaderboards. Check route status, H1 presence, canonical URL, and absence of self-canonical 404 pages.
- **Expected result:** Navigation routes resolve to meaningful pages, expose one clear H1 where appropriate, and do not canonicalize broken pages.
- **Automation fit:** Playwright E2E route matrix plus lightweight DOM checks.

### 5. Forms, Auth-Adjacent UI, and Unsafe Input Handling
- **Risk covered:** Forms are business-critical and frequently become security/a11y weak points. The sponsor lead form and comment composer deserve special attention.
- **Flow:** Test sponsor inquiry required fields, email/URL validation, unsafe URL schemes such as `javascript:alert(1)`, and authenticated comment composer semantics without posting malicious payloads to production.
- **Expected result:** Required fields expose semantic validation, URL fields reject unsafe schemes, invalid input cannot advance the form, and authenticated editors have accessible labels and named controls.
- **Automation fit:** Playwright for safe validation checks; manual gated testing for authenticated write flows using a disposable account or staging environment.

## API and Security Scenarios

### 6. Authentication and Token Error Contract
- **Risk covered:** The API is developer-facing, so auth failures must be predictable and safe. Missing or invalid tokens should not leak internals or behave inconsistently.
- **Flow:** Send a read query with no bearer token, an invalid bearer token, and a valid bearer token when available.
- **Expected result:** Missing/invalid tokens return a consistent 401 contract. Valid tokens can access read-only queries. Error bodies should be structured and should not expose stack traces or implementation details.
- **Automation fit:** Bun API tests. Missing/invalid token tests run without secrets; valid-token tests skip when `PH_API_TOKEN` is absent.

### 7. Core GraphQL Posts Contract
- **Risk covered:** `posts` is a core public API object. Type drift here breaks integrations and undermines developer confidence.
- **Flow:** Query `posts(first: 5)` for `id`, `name`, `tagline`, `votesCount`, and `pageInfo`.
- **Expected result:** HTTP 200, no GraphQL errors, typed values match the documented schema, and the connection shape remains stable.
- **Automation fit:** Bun API test with TypeScript response types.

### 8. Cursor Pagination Correctness and Bounds
- **Risk covered:** Pagination bugs cause duplicate/missing data and can hide backend boundary issues.
- **Flow:** Fetch `posts(first: 5)`, capture `endCursor`, fetch the next page with `after`, then test invalid cursors and oversized `first` values.
- **Expected result:** Valid page 2 has distinct IDs from page 1. Invalid cursors and invalid page-size values should return explicit validation errors or documented clamping, not silently fail open.
- **Automation fit:** Bun API test. Keep read-only and avoid loops.

### 9. GraphQL Validation, Parser, and Malformed Payload Handling
- **Risk covered:** Malformed API requests should be client errors, not production 500s. This is both reliability and security posture.
- **Flow:** Send invalid fields, non-string `query`, malformed `variables`, mismatched `operationName`, and syntactically invalid GraphQL.
- **Expected result:** The API returns structured 4xx or GraphQL validation errors, never a 5xx, stack trace, HTML error page, or unexpected successful execution.
- **Automation fit:** Bun API tests. This is one of the strongest backend/security-oriented scenarios.

### 10. Rate Limit, Complexity, and Official Developer Sample Safety
- **Risk covered:** Product Hunt exposes an API to external developers. Weak complexity controls or unsafe official starter code can create platform-wide risk.
- **Flow:** Compare rate-limit headers/debit for a small query and a broader aliased query. Review official starter app behavior around OAuth `state`, cookie flags, token storage, and proxying upstream API status/headers.
- **Expected result:** Query complexity should affect rate-limit cost or be otherwise documented. Starter code should use OAuth `state`, hardened cookies, and preserve upstream status/rate-limit headers.
- **Automation fit:** Partly automated with API header assertions; partly manual/security review because OAuth and sample-code checks need ethical boundaries.

## Recommended Submission Framing

Use these ten scenarios as the main test-plan answer, then point to `docs/findings.md` as evidence from exploratory testing. This keeps the submission focused on major product flows while still showing that deeper defect research was performed.
