# Automation Architecture

## Frontend

- **Framework:** Playwright `1.61.1` with TypeScript.
- **Suite size for assignment:** 8 core scenarios, selected with `@core`.
- **Pattern:** Page Object Model under `tests/e2e/pages`, injected through Playwright fixtures in `tests/e2e/fixtures.ts`.
- **Core page objects:**
  - `BasePage` owns navigation, response assertions, and shared locators.
  - `HomePage` owns launch-feed selectors.
  - `NavigationPage` owns primary navigation flows.
  - `ProductPage` owns product-detail entry from the launch feed.
  - `SearchPage` owns search URL, results, and pagination behavior.
- **Wait strategy:** Playwright web-first assertions and `waitForResponse`; no hard sleeps.
- **Response validation:** Critical page loads and navigation actions assert document responses are present and below `400`. Search pagination waits for the page-2 document response before asserting URL/DOM state.
- **Reporting/debugging:** HTML reports locally; GitHub annotations in CI; trace, screenshot, and video artifacts retained for failures/retries.
- **CI stability:** `forbidOnly`, retries, and a single CI worker are configured. Local runs can still use Playwright's normal parallelism.

## Backend/API

- **Framework:** Bun test with TypeScript.
- **Suite size for assignment:** 6 core API tests via `bun run test:api`.
- **Pattern:** Typed service/client model.
- **Core service:** `ProductHuntApi` wraps GraphQL requests so tests describe behavior instead of repeating request details.
- **Coverage:** Auth contract, typed `posts` connection, cursor pagination, validation errors, and malformed payload handling.
- **Secrets:** `PH_API_TOKEN` is read only from the environment. Token-gated tests skip when the token is missing; missing/invalid-token tests still run.

## Live-Site Limitation

Current local headless Playwright traffic to `https://www.producthunt.com` receives a Cloudflare security-verification `403` before the app loads. The tests intentionally assert response status instead of bypassing this. In a trusted browser session, staging environment, or CI/network allowlist, the same POM suite can validate the actual UI flows.
